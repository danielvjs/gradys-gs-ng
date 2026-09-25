"""Controle de missão do embedded, um WebSocket próprio.

Por que não reusar o PostConsumer: ele manda O MESMO payload pra todo drone da
lista, no IP que veio da telemetria. Missão precisa do contrário — protocolo e
posição inicial variam por drone, a porta é outra, e o operador tem que ver
sucesso e erro POR DRONE, não um ack agregado.

O navegador não pode falar direto com o drone: o FastAPI do embedded não tem
CORS, então a resposta seria bloqueada. Este consumer é a ponte.
"""

import asyncio
import base64
import json

import aiohttp
from channels.generic.websocket import AsyncWebsocketConsumer

from ..embedded import build_node_ip_dict, control_base_url
from ..utils.logger import Logger
from .update_periodically_consumer import get_device_from_list_by_id

logger = Logger()

# Timeout curto de propósito: um drone que não responde em 10 s precisa aparecer
# como erro na tela, não travar o lote inteiro esperando o TCP desistir.
TIMEOUT = aiohttp.ClientTimeout(total=10)


class MissionConsumer(AsyncWebsocketConsumer):

  async def connect(self):
    await self.accept()

  async def disconnect(self, close_code):
    print(f'Mission websocket disconnected {close_code}')

  async def receive(self, text_data):
    try:
      message = json.loads(text_data)
      await self.dispatch_action(message)
    except Exception:
      logger.log_except()

  # ---------------------------------------------------------------- despacho

  async def dispatch_action(self, message):
    action = message.get('action')

    # 'peers' não fala com drone nenhum: é o mapa de vizinhos que a estação
    # montaria, devolvido pra tela conferir ANTES de armar. O mapa é regra pura
    # (connections/embedded.py), e é a estação que decide as portas — pedir a
    # cada drone o que ela mesma calcula seria inventar uma chance de discordar.
    if action == 'peers':
      devices = self.resolve([{'id': i} for i in message.get('ids', [])])
      await self.send(json.dumps({
        'action': 'peers', 'done': True,
        'node_ip_dict': build_node_ip_dict([d for _, d in devices if d is not None]),
      }))
      return

    if action in ('protocols', 'status'):
      rows = [{'id': i} for i in message.get('ids', [])]
    elif action == 'load':
      rows = message.get('rows', [])
    elif action in ('setup', 'start', 'stop', 'reset', 'upload'):
      rows = [{'id': i} for i in message.get('ids', [])]
    else:
      await self.report(action, None, False, f'Ação desconhecida: {action}')
      return

    devices = self.resolve(rows)

    # O mapa de vizinhos é montado aqui, uma vez, e vai IGUAL pra todos — é isso
    # que o docstring do LoadRequest do embedded chama de responsabilidade da
    # camada de missão. Ele volta pra tela pro operador conferir antes de armar.
    # Um id que não está na lista vira (row, None) no resolve(); passar None pro
    # build_node_ip_dict quebraria .get('id') antes de qualquer report ser
    # mandado, e a mensagem de erro nunca chegaria na tela.
    node_ip_dict = build_node_ip_dict([d for _, d in devices if d is not None])

    async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
      tasks = [
        asyncio.create_task(
          self.call_one(session, action, row, device, message, node_ip_dict)
        )
        for row, device in devices
      ]
      await asyncio.gather(*tasks, return_exceptions=True)

    await self.send(json.dumps({
      'action': action, 'done': True, 'node_ip_dict': node_ip_dict,
    }))

  def resolve(self, rows):
    """Casa cada linha da tabela com o device da lista persistente.

    Um drone que nunca reportou telemetria não está na lista, e a estação não tem
    como saber o host dele. Isso vira erro na tela em vez de silêncio.
    """
    resolved = []
    for row in rows:
      found = get_device_from_list_by_id(str(row.get('id')))
      if not found:
        resolved.append((row, None))
      else:
        resolved.append((row, found[0]))
    return resolved

  # ----------------------------------------------------------------- chamada

  async def call_one(self, session, action, row, device, message, node_ip_dict):
    drone_id = row.get('id')

    if device is None:
      await self.report(
        action, drone_id, False,
        'Drone não está na lista: nunca reportou telemetria, então a estação não sabe o endereço dele',
      )
      return

    base = control_base_url(device)

    try:
      if action == 'protocols':
        ok, data = await self.get(session, f'{base}/protocols')
      elif action == 'status':
        ok, data = await self.get(session, f'{base}/mission/status')
      elif action == 'upload':
        ok, data = await self.upload(session, base, message)
      elif action == 'load':
        ok, data = await self.post(session, f'{base}/mission/load',
                                   self.load_body(row, message, node_ip_dict))
      else:
        ok, data = await self.post(session, f'{base}/mission/{action}', None)
    except aiohttp.ClientError as exc:
      # Inalcançável é o caso NORMAL nesta entrega: não há embedded rodando.
      # Tem que virar uma linha legível na tela, não uma exceção engolida.
      await self.report(action, drone_id, False, f'Inalcançável em {base}: {exc}')
      return
    except asyncio.TimeoutError:
      await self.report(action, drone_id, False, f'Sem resposta de {base} em 10 s')
      return
    except Exception as exc:
      # Rede de segurança, não substituto dos except acima: o contrato desta
      # ponte é UMA mensagem por drone, sempre. Um base64 mal formado
      # (binascii.Error) ou uma resposta que não é JSON (JSONDecodeError, num
      # 500 em texto puro do embedded, por exemplo) não são ClientError nem
      # TimeoutError, e o gather(return_exceptions=True) do chamador engoliria
      # a exceção em silêncio — o drone ficaria sem nenhuma mensagem individual,
      # só o 'done' do lote chegaria, e a tela ficaria esperando pra sempre.
      # Silêncio numa tela de missão é pior que erro: não dá pra distinguir de
      # "ainda processando".
      await self.report(
        action, drone_id, False,
        f'Erro inesperado falando com {base}: {type(exc).__name__}: {exc}',
      )
      return

    if ok:
      await self.report(action, drone_id, True, None, data)
    else:
      await self.report(action, drone_id, False, self.detail_of(data))

  @staticmethod
  def load_body(row, message, node_ip_dict):
    """O corpo do POST /mission/load, na forma que o embedded valida.

    A referência é fleet/sim/smoke.sh, que é o gradys-gs de mentira que o fleet
    usa pra provar a arquitetura sem estação. Os campos são os mesmos e na mesma
    forma: protocolo por drone, initial_position por drone, e frame + peer map
    IDÊNTICOS em toda a frota.

    initial_position não é opcional na prática: /mission/setup devolve 400
    ("No initial_position for this mission") sem ele, então o drone carrega e
    trava. A tela exige a coluna antes de liberar o Load; ainda assim o campo só
    é mandado quando existe, pra um erro de tela não virar [null,null,null].
    """
    frame = message.get('frame') or {}
    body = {
      'protocol': row.get('protocol'),
      'node_ip_dict': node_ip_dict,
      'origin_gps_coordinates': frame.get('origin_gps_coordinates'),
      'x_axis_degrees': frame.get('x_axis_degrees'),
    }
    if row.get('initial_position') is not None:
      body['initial_position'] = row['initial_position']
    # O transporte é escolhido por missão e tem que ser IGUAL em toda a frota —
    # transportes misturados não se falam. Omitir deixa o embedded aplicar o
    # default dele ("http"); mandar explícito é o que permite escolher outro na
    # tela e conferir no /mission/status depois.
    if message.get('communication_protocol'):
      body['communication_protocol'] = message['communication_protocol']
    if message.get('label'):
      body['label'] = message['label']
    return body

  async def upload(self, session, base, message):
    content = base64.b64decode(message.get('content', ''))
    # Buffer novo por requisição: um mesmo stream reusado entre drones sai
    # consumido no segundo, e o upload falha em silêncio. O PostConsumer já
    # levou esse bug uma vez.
    form = aiohttp.FormData()
    form.add_field('file', content,
                   filename=message.get('filename', 'protocol.py'),
                   content_type='text/x-python')
    async with session.post(f'{base}/protocols/upload', data=form) as resp:
      return resp.status < 400, await resp.json(content_type=None)

  async def get(self, session, url):
    async with session.get(url) as resp:
      return resp.status < 400, await resp.json(content_type=None)

  async def post(self, session, url, body):
    async with session.post(url, json=body) as resp:
      return resp.status < 400, await resp.json(content_type=None)

  @staticmethod
  def detail_of(data):
    # O FastAPI devolve o motivo em 'detail'. Mostrar o motivo é o ponto: um 409
    # do /mission/load significa "já tem missão rodando", e o operador precisa
    # ler isso, não um número.
    if isinstance(data, dict) and 'detail' in data:
      return str(data['detail'])
    return str(data)

  async def report(self, action, drone_id, ok, error=None, data=None):
    payload = {'action': action, 'drone_id': drone_id, 'ok': ok}
    if error is not None:
      payload['error'] = error
    if data is not None:
      payload['data'] = data
    await self.send(json.dumps(payload))
