"""Onde fica o control API do gradys-embedded de cada drone.

A lista persistente de devices guarda o 'ip' que veio na telemetria, que é o do
vehicle_api. O control API do embedded está no mesmo host, noutra porta — o
embedded fala com o uav_api em localhost, então os dois nunca estão separados.

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
CONTROL_API_PORT = config.getint('embedded', 'control_api_port', fallback=6000)
DATA_API_PORT = config.getint('embedded', 'data_api_port', fallback=5000)
PORT_STEP = config.getint('embedded', 'port_step', fallback=1)


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
  try:
    offset = int(node_id) * PORT_STEP
  except (TypeError, ValueError):
    # Um id não numérico não tem deslocamento possível; usar a porta base é o
    # comportamento de host único, que é o caso em campo.
    offset = 0
  return base + offset


def control_base_url(device):
  return f"http://{host_of(device.get('ip'))}:{_port(CONTROL_API_PORT, device.get('id'))}"


def data_plane_url(device):
  return f"http://{host_of(device.get('ip'))}:{_port(DATA_API_PORT, device.get('id'))}"


def build_node_ip_dict(devices):
  """O mapa de vizinhos que vai igual pra todo drone da missão.

  Chaves string porque JSON não tem chave inteira; o Pydantic do embedded
  declara Dict[int, str] e converte na entrada.
  """
  return {str(d.get('id')): data_plane_url(d) for d in devices}
