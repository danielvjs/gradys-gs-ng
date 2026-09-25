"""A ponte inteira, contra um embedded falso que escuta de verdade.

`tests.py` compara a FORMA do que a estação manda. Aqui o WebSocket é aberto, o
consumer faz requisição HTTP real num socket local, e o que volta é o que a tela
receberia. O que isso pega e o outro não: rota errada, verbo errado, multipart
mal montado, erro do drone que não vira mensagem, lote que nunca manda 'done'.

O drone falso é deliberadamente burro em tudo, MENOS numa coisa: o corpo do
/mission/load passa pelo `MissionConfiguration` do embedded de verdade, quando
ele está no path. É o único juiz que não é a nossa própria opinião sobre o
contrato. Sem ele, o teste ainda vale como fiação; com ele, vale como contrato.

    # com o repo `embedded` ao lado, que é o que fecha o ciclo:
    PYTHONPATH=../embedded python manage.py test connections

Ninguém sai da máquina: o servidor sobe em 127.0.0.1 numa porta que o sistema
escolhe, e o CONTROL_API_PORT do módulo aponta pra ela enquanto o teste roda.
"""

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase

from . import embedded
from .consumers_wrapper import update_periodically_consumer
from .consumers_wrapper.mission_consumer import MissionConsumer

# O que o drone falso recebeu, pro teste conferir depois. Uma lista só porque o
# servidor roda numa thread e o teste na outra — nada aqui precisa de lock: o
# teste só lê depois do 'done', que só chega depois da resposta HTTP.
RECEIVED = []


class FakeEmbedded(BaseHTTPRequestHandler):
  """Só as rotas que a aba Missão usa, com os corpos que o embedded devolve."""

  state = 'idle'

  def log_message(self, *args):
    pass  # senão cada requisição vira ruído no output do teste

  def reply(self, status, body):
    payload = json.dumps(body).encode()
    self.send_response(status)
    self.send_header('Content-Type', 'application/json')
    self.send_header('Content-Length', str(len(payload)))
    self.end_headers()
    self.wfile.write(payload)

  def do_GET(self):
    if self.path == '/protocols':
      # embedded/control/routers/protocols.py: {"protocols": [ {...}, ... ]}
      self.reply(200, {'protocols': [
        {'name': 'smoke_protocol', 'module': 'smoke_protocol',
         'size_bytes': 12, 'modified': '2026-09-17T00:00:00+00:00'},
      ]})
    elif self.path == '/mission/status':
      # embedded/control/mission/manager.py: status()
      self.reply(200, {
        'state': FakeEmbedded.state, 'node_id': 1, 'run_id': None,
        'protocol': None, 'elapsed_seconds': None, 'tracked_variables': {},
        'frame': None, 'dependencies': None,
      })
    else:
      self.reply(404, {'detail': f'Not Found: {self.path}'})

  def do_POST(self):
    length = int(self.headers.get('Content-Length', 0))
    raw = self.rfile.read(length)
    RECEIVED.append((self.path, raw, self.headers.get('Content-Type', '')))

    if self.path == '/protocols/upload':
      self.reply(200, {'protocol': 'smoke_protocol',
                       'path': '/opt/gradys/protocols/smoke_protocol.py',
                       'size_bytes': len(raw)})
    elif self.path == '/mission/load':
      body = json.loads(raw)
      try:
        self.validate(body)
      except Exception as exc:
        # É o 400 que o embedded devolveria, com o motivo em 'detail' — que é
        # exatamente o campo que a tela mostra.
        self.reply(400, {'detail': str(exc)})
        return
      if FakeEmbedded.state != 'idle':
        # O 409 do embedded real: manager.load() recusa fora de idle. O motivo
        # vem em 'detail', e é ele que tem que chegar na tela.
        self.reply(409, {'detail': f'Cannot load a mission while {FakeEmbedded.state}; '
                                   f'stop the current mission first'})
        return
      FakeEmbedded.state = 'loaded'
      self.reply(200, {'state': 'loaded', 'run_id': 'run_20260917_120000_smoke'})
    elif self.path in ('/mission/setup', '/mission/start', '/mission/stop', '/mission/reset'):
      self.reply(200, {'state': self.path.rsplit('/', 1)[1]})
    else:
      self.reply(404, {'detail': f'Not Found: {self.path}'})

  @staticmethod
  def validate(body):
    """O validador do embedded, se ele estiver aqui. Senão, nada."""
    try:
      from embedded.config.mission import MissionConfiguration
    except ImportError:
      return
    MissionConfiguration(
      node_ip_dict=body.get('node_ip_dict'),
      initial_position=body.get('initial_position'),
      origin_gps_coordinates=body.get('origin_gps_coordinates'),
      x_axis_degrees=body.get('x_axis_degrees'),
      communication_protocol=body.get('communication_protocol', 'http'),
    )


class MissionBridgeTest(TransactionTestCase):

  @classmethod
  def setUpClass(cls):
    super().setUpClass()
    # Porta 0: o sistema escolhe uma livre. Fixar a 6000 do config.ini parecia
    # mais realista e era uma armadilha — com um embedded (ou uma demo) já
    # escutando ali, o allow_reuse_address do HTTPServer deixa o bind PASSAR no
    # Windows e o teste vai falar com o processo errado. Falhava como se o
    # código estivesse quebrado, o que custa mais caro que o realismo valia.
    cls.server = HTTPServer(('127.0.0.1', 0), FakeEmbedded)
    cls.port = cls.server.server_address[1]
    # control_base_url lê este global na hora da chamada, então trocá-lo aqui é
    # o bastante pra apontar a ponte inteira pro drone falso.
    cls.previous_port = embedded.CONTROL_API_PORT
    embedded.CONTROL_API_PORT = cls.port
    cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
    cls.thread.start()

  @classmethod
  def tearDownClass(cls):
    embedded.CONTROL_API_PORT = cls.previous_port
    cls.server.shutdown()
    cls.server.server_close()
    cls.thread.join(timeout=5)
    super().tearDownClass()

  def setUp(self):
    RECEIVED.clear()
    FakeEmbedded.state = 'idle'
    # O drone 1 como a telemetria o teria deixado: só o host, que é o do
    # vehicle_api. A porta de controle é derivada, não vem daqui — é o que
    # setUpClass aponta pro drone falso.
    self.previous = list(update_periodically_consumer.device_list_persistent)
    update_periodically_consumer.device_list_persistent[:] = [
      {'id': 1, 'ip': '127.0.0.1:8000/', 'device': 'uav'},
    ]

  def tearDown(self):
    update_periodically_consumer.device_list_persistent[:] = self.previous

  async def exchange(self, payload):
    """Manda uma ação e devolve tudo que a tela receberia até o 'done'."""
    communicator = WebsocketCommunicator(MissionConsumer.as_asgi(), '/ws/mission/')
    connected, _ = await communicator.connect()
    self.assertTrue(connected)
    await communicator.send_json_to(payload)

    messages = []
    while True:
      message = await communicator.receive_json_from(timeout=15)
      messages.append(message)
      if message.get('done'):
        break
    await communicator.disconnect()
    return messages

  # ------------------------------------------------------------------ testes

  async def test_protocols_reaches_the_drone_and_comes_back_named(self):
    messages = await self.exchange({'action': 'protocols', 'ids': [1]})
    self.assertEqual(messages[0]['ok'], True, messages[0].get('error'))
    self.assertEqual([p['name'] for p in messages[0]['data']['protocols']],
                     ['smoke_protocol'])

  async def test_load_is_accepted_by_the_real_validator(self):
    messages = await self.exchange({
      'action': 'load',
      'frame': {'origin_gps_coordinates': [-15.840081, -47.926642, 0],
                'x_axis_degrees': 0},
      'communication_protocol': 'http',
      'rows': [{'id': 1, 'protocol': 'smoke_protocol', 'initial_position': [0, 0, 20]}],
    })
    # Se o node_ip_dict voltar a levar esquema, é AQUI que aparece: o drone
    # falso responde 400 com o ValueError do embedded, e este assert mostra o
    # motivo inteiro em vez de só falhar.
    self.assertEqual(messages[0]['ok'], True, messages[0].get('error'))
    self.assertEqual(messages[0]['data']['run_id'], 'run_20260917_120000_smoke')

    path, raw, _ = RECEIVED[0]
    self.assertEqual(path, '/mission/load')
    self.assertEqual(json.loads(raw)['node_ip_dict'], {'1': '127.0.0.1:5000'})

  async def test_the_batch_always_ends_with_done_and_the_peer_map(self):
    messages = await self.exchange({'action': 'status', 'ids': [1]})
    self.assertTrue(messages[-1]['done'])
    self.assertEqual(messages[-1]['node_ip_dict'], {'1': '127.0.0.1:5000'})

  async def test_upload_arrives_as_multipart(self):
    messages = await self.exchange({
      'action': 'upload', 'ids': [1],
      'filename': 'smoke_protocol.py',
      'content': 'cGFzcw==',  # base64 de 'pass'
    })
    self.assertEqual(messages[0]['ok'], True, messages[0].get('error'))
    path, raw, content_type = RECEIVED[0]
    self.assertEqual(path, '/protocols/upload')
    self.assertIn('multipart/form-data', content_type)
    self.assertIn(b'filename="smoke_protocol.py"', raw)
    self.assertIn(b'pass', raw)

  async def test_reset_reaches_the_drone(self):
    # O caminho que não existia antes: a única saída de uma missão que carregou
    # e travou no setup.
    messages = await self.exchange({'action': 'reset', 'ids': [1]})
    self.assertEqual(messages[0]['ok'], True, messages[0].get('error'))
    self.assertEqual(RECEIVED[0][0], '/mission/reset')

  async def test_a_drone_that_never_reported_telemetry_becomes_a_message(self):
    # Silêncio numa tela de missão não se distingue de "ainda processando".
    messages = await self.exchange({'action': 'status', 'ids': [99]})
    self.assertEqual(messages[0]['ok'], False)
    self.assertIn('não está na lista', messages[0]['error'])

  async def test_a_refused_load_reaches_the_screen_with_the_drones_reason(self):
    """O 409 não pode virar 'deu erro': o motivo é o que o operador age sobre."""
    carga = {
      'action': 'load',
      'frame': {'origin_gps_coordinates': [-15.840081, -47.926642, 0], 'x_axis_degrees': 0},
      'rows': [{'id': 1, 'protocol': 'smoke_protocol', 'initial_position': [0, 0, 20]}],
    }
    primeira = await self.exchange(carga)
    self.assertEqual(primeira[0]['ok'], True, primeira[0].get('error'))

    # segunda tentativa sem parar a missão: é o que o drone recusa
    segunda = await self.exchange(carga)
    self.assertEqual(segunda[0]['ok'], False)
    self.assertIn('Cannot load a mission while loaded', segunda[0]['error'])
    # e o lote ainda fecha: uma recusa não pode deixar a tela esperando pra sempre
    self.assertTrue(segunda[-1]['done'])

  async def test_peers_answers_without_touching_any_drone(self):
    """O mapa de vizinhos sai da regra da estação, não de uma pergunta ao drone.

    Se um dia ele passar a depender de alguém responder, a conferência que o
    operador faz antes de armar deixa de existir justamente quando um drone
    está mudo — que é quando ela mais importa.
    """
    messages = await self.exchange({'action': 'peers', 'ids': [1]})
    self.assertEqual(messages[0]['node_ip_dict'], {'1': '127.0.0.1:5000'})
    self.assertTrue(messages[0]['done'])
    self.assertEqual(RECEIVED, [], 'peers não pode gerar requisição pro drone')

  async def test_peers_leaves_out_a_drone_the_station_has_no_address_for(self):
    messages = await self.exchange({'action': 'peers', 'ids': [1, 99]})
    self.assertEqual(messages[0]['node_ip_dict'], {'1': '127.0.0.1:5000'})
