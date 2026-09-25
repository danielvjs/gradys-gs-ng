"""Testes de contrato da aba Missão contra o embedded real.

O que estes testes protegem é UMA coisa: a estação e o drone concordam sobre a
forma dos endereços e do corpo do POST /mission/load. Nada aqui sobe rede.

A referência não é a documentação — é `fleet/sim/smoke.sh`, o script que o fleet
usa como gradys-gs de mentira pra provar a arquitetura ponta a ponta sem
estação. O corpo que ele manda é, por construção, um corpo que o embedded
aceita; `load_body_for` abaixo reproduz aquele corpo.

`MissionConfigurationTest` fecha o ciclo quando o pacote `embedded` está
instalado no mesmo venv: alimenta o corpo ao validador DELE, em vez de
comparar com a nossa cópia do que achamos que ele exige. Sem o pacote, pula —
uma máquina de operador não precisa ter o runtime do drone instalado.

    python manage.py test connections
"""

from django.test import SimpleTestCase

from .embedded import build_node_ip_dict, control_base_url, data_plane_address, host_of
from .consumers_wrapper.mission_consumer import MissionConsumer

# Os drones do fleet/inventory/hosts.yml, na forma em que a telemetria os
# deposita na lista persistente. O 'ip' é o do vehicle_api, e chega com e sem
# esquema conforme o caminho — as duas formas estão representadas de propósito.
DEVICES = [
  {'id': 1, 'ip': '10.0.2.11:8000/'},
  {'id': 2, 'ip': 'http://10.0.2.12:8000/'},
  {'id': 3, 'ip': '10.0.2.13:8000'},
]

FRAME = {'origin_gps_coordinates': [-15.840081, -47.926642, 0], 'x_axis_degrees': 0}


def load_body_for(index):
  """O corpo que a estação monta para o index-ésimo drone do smoke.sh."""
  row = {
    'id': DEVICES[index]['id'],
    'protocol': 'smoke_protocol',
    'initial_position': [index * 10, 0, 20],
  }
  message = {'frame': FRAME, 'label': 'smoke', 'communication_protocol': 'http'}
  return MissionConsumer.load_body(row, message, build_node_ip_dict(DEVICES))


class AddressTest(SimpleTestCase):

  def test_host_survives_every_form_the_telemetry_uses(self):
    for device in DEVICES:
      self.assertEqual(host_of(device['ip']), f"10.0.2.1{device['id']}")

  def test_control_url_carries_a_scheme(self):
    # É uma URL: a estação vai chamar.
    self.assertEqual(control_base_url(DEVICES[0]), 'http://10.0.2.11:6000')

  def test_data_plane_address_has_no_scheme(self):
    # NÃO é URL: vai dentro do node_ip_dict, e o embedded levanta ValueError em
    # qualquer valor com '://' — o caminho de envio dele monta
    # f"http://{addr}/message". Ver embedded/config/mission.py.
    address = data_plane_address(DEVICES[0])
    self.assertEqual(address, '10.0.2.11:5000')
    self.assertNotIn('://', address)

  def test_ports_are_fixed_across_the_fleet(self):
    # Cada drone é seu próprio host, em campo e no SITL do fleet. Porta por id
    # mandaria o drone 3 pra 6003, onde não há nada escutando.
    self.assertEqual(
      build_node_ip_dict(DEVICES),
      {'1': '10.0.2.11:5000', '2': '10.0.2.12:5000', '3': '10.0.2.13:5000'},
    )


class LoadBodyTest(SimpleTestCase):
  """O corpo do load, comparado com o do smoke.sh drone por drone."""

  maxDiff = None

  def test_matches_the_smoke_test_payload(self):
    self.assertEqual(load_body_for(0), {
      'protocol': 'smoke_protocol',
      'initial_position': [0, 0, 20],
      'origin_gps_coordinates': [-15.840081, -47.926642, 0],
      'x_axis_degrees': 0,
      'node_ip_dict': {'1': '10.0.2.11:5000', '2': '10.0.2.12:5000', '3': '10.0.2.13:5000'},
      'communication_protocol': 'http',
      'label': 'smoke',
    })

  def test_peer_map_and_frame_are_identical_across_the_fleet(self):
    # O que varia entre drones é initial_position e mais nada. Tudo o mais
    # idêntico é o que o /mission/status devolve pra tela conferir antes do
    # Start; divergência aqui não daria erro em drone nenhum, só
    # dessincronizaria os frames cartesianos — e isso só apareceria nos dados
    # depois do voo.
    bodies = [load_body_for(i) for i in range(len(DEVICES))]
    for key in ('node_ip_dict', 'origin_gps_coordinates', 'x_axis_degrees',
                'communication_protocol', 'protocol'):
      self.assertEqual(
        len({repr(body[key]) for body in bodies}), 1,
        f'{key} deveria ser igual em toda a frota',
      )
    self.assertEqual([body['initial_position'] for body in bodies],
                     [[0, 0, 20], [10, 0, 20], [20, 0, 20]])

  def test_initial_position_is_omitted_rather_than_sent_null(self):
    body = MissionConsumer.load_body(
      {'id': 1, 'protocol': 'p'}, {'frame': FRAME}, build_node_ip_dict(DEVICES),
    )
    self.assertNotIn('initial_position', body)


class MissionConfigurationTest(SimpleTestCase):
  """O corpo passa pelo validador do PRÓPRIO embedded — quando ele está aqui."""

  def setUp(self):
    try:
      from embedded.config.mission import MissionConfiguration
    except ImportError:
      self.skipTest('pacote `embedded` não instalado neste venv')
    self.MissionConfiguration = MissionConfiguration

  def build(self, body):
    return self.MissionConfiguration(
      node_ip_dict=body['node_ip_dict'],
      initial_position=body.get('initial_position'),
      origin_gps_coordinates=body['origin_gps_coordinates'],
      x_axis_degrees=body['x_axis_degrees'],
      communication_protocol=body.get('communication_protocol', 'http'),
    )

  def test_the_body_we_send_is_accepted(self):
    body = load_body_for(0)
    mission = self.build(body)
    # As chaves string do JSON viram int do lado de lá; é o que o Pydantic faz
    # com Dict[int, str] e o que o __post_init__ confirma.
    self.assertEqual(mission.node_ip_dict[1], '10.0.2.11:5000')

  def test_a_scheme_in_the_peer_map_is_what_the_old_code_sent(self):
    # Guarda o bug que motivou a correção: enquanto build_node_ip_dict devolvia
    # 'http://host:5000', TODO load era recusado. Se alguém puser o esquema de
    # volta, este teste é quem explica por que não pode.
    body = dict(load_body_for(0))
    body['node_ip_dict'] = {'1': 'http://10.0.2.11:5000'}
    with self.assertRaises(ValueError):
      self.build(body)
