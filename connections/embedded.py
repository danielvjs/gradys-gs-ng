"""Onde fica o control API do embedded de cada drone, e como nomear o data plane.

A lista persistente de devices guarda o 'ip' que veio na telemetria, que é o do
vehicle_api. O control API do embedded está no mesmo host, noutra porta — o
embedded fala com o vehicle_api em localhost, então os dois nunca estão
separados.

Duas formas de endereço saem daqui, e a diferença NÃO é cosmética:

  control_base_url()     'http://10.0.2.11:6000'  — URL, a estação vai chamar
  data_plane_address()   '10.0.2.11:5000'         — host:port CRU, vai no corpo

O segundo é o que entra no node_ip_dict. O embedded recusa um valor com esquema:
MissionConfiguration.__post_init__ levanta ValueError em '://' porque o caminho
de envio monta f"http://{addr}/message" — um esquema aqui viraria
'http://http://…' e todo envio entre drones falharia em silêncio. Ver
embedded/config/mission.py.

Só regra, nenhum I/O: quem faz requisição é o MissionConsumer.
"""

import configparser

config = configparser.ConfigParser()
config.read('config.ini')

# Com fallback, ao contrário do resto do projeto: as seções que os outros
# módulos leem sempre existiram em todo config.ini. [embedded] é nova, cada
# deploy edita esse arquivo localmente, e este módulo é importado no boot do
# ASGI (via mission_consumer -> routing) — faltar a seção não pode derrubar
# mapa, frota e comandos por causa de uma aba que ninguém vai usar.
#
# Os nomes e os defaults são os do embedded provisionado: control_api_port e
# data_port, 6000 e 5000 (embedded/packaging/embedded.toml.example, e
# fleet/inventory/group_vars/drones.yml, que é quem de fato rende o .toml).
CONTROL_API_PORT = config.getint('embedded', 'control_api_port', fallback=6000)
DATA_PORT = config.getint(
  'embedded', 'data_port',
  fallback=config.getint('embedded', 'data_api_port', fallback=5000),
)
# 0 = porta fixa, que é o caso de TODO deploy documentado: em campo cada drone é
# uma Raspberry Pi com seu próprio IP, e no SITL do fleet cada drone é um
# contêiner com seu próprio IP (fleet/sim/smoke.sh fixa CTRL_PORT=6000 e
# DATA_PORT=5000 para os três). O passo só faz sentido se alguém rodar vários
# embeddeds num host só, fora do fleet — por isso o knob continua existindo,
# mas desligado.
PORT_STEP = config.getint('embedded', 'port_step', fallback=0)


def host_of(ip):
  """Extrai só o host do 'ip' da lista persistente.

  Esse campo é inconsistente por herança: às vezes chega '10.0.0.11:8000/',
  às vezes 'http://10.0.0.11:8000/'. O post_consumers monta URL concatenando
  'http://' + ip, o que assume a primeira forma. Aqui a gente aceita as duas em
  vez de propagar a suposição.
  """
  text = str(ip or '').strip()
  if '://' in text:
    text = text.split('://', 1)[1]
  text = text.split('/', 1)[0]
  return text.split(':', 1)[0]


def _port(base, node_id):
  if PORT_STEP == 0:
    return base
  try:
    offset = int(node_id) * PORT_STEP
  except (TypeError, ValueError):
    # Um id não numérico não tem deslocamento possível; usar a porta base é o
    # comportamento de host único, que é o caso em campo.
    offset = 0
  return base + offset


def control_base_url(device):
  """URL do control API daquele drone — é a estação que vai chamar."""
  return f"http://{host_of(device.get('ip'))}:{_port(CONTROL_API_PORT, device.get('id'))}"


def data_plane_address(device):
  """Endereço do data plane daquele drone, CRU: 'host:port', sem esquema.

  É assim que vai no node_ip_dict, e o embedded recusa qualquer outra forma.
  """
  return f"{host_of(device.get('ip'))}:{_port(DATA_PORT, device.get('id'))}"


def build_node_ip_dict(devices):
  """O mapa de vizinhos que vai igual pra todo drone da missão.

  Chaves string porque JSON não tem chave inteira; o Pydantic do embedded
  declara Dict[int, str] e converte na entrada.
  """
  return {str(d.get('id')): data_plane_address(d) for d in devices}
