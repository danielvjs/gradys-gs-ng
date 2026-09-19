import json

from django.shortcuts import render
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from asgiref.sync import async_to_sync

from .consumers_wrapper.post_consumers import get_post_consumer_instance
from .consumers_wrapper.update_periodically_consumer import get_device_from_list_by_id
import configparser

config = configparser.ConfigParser()
config.read('config.ini')


def index(request):
  context = {
    'google_maps_key': settings.GOOGLE_MAPS_API_KEY,
    'server_address': config['server']['ip_groundstation_server']
  }
  return render(request, 'index.html', context=context)


def create_new_dict(request_received):
  ip = config['uav-simulator']['ip_uav_server']

  new_dict = {}
  if request_received.POST.get('id') != None:
    new_dict['id'] = int(request_received.POST.get('id'))
  if request_received.POST.get('type') != None:
    new_dict['type'] = int(request_received.POST.get('type'))
  if request_received.POST.get('seq') != None:
    new_dict['seq'] = int(request_received.POST.get('seq'))
  if request_received.POST.get('lat') != None:
    new_dict['lat'] = float(request_received.POST.get('lat'))
  if request_received.POST.get('lng') != None:
    new_dict['lng'] = float(request_received.POST.get('lng'))
  if request_received.POST.get('alt') != None:
    new_dict['alt'] = float(request_received.POST.get('alt'))
  if request_received.POST.get('ground_speed') != None:
    new_dict['ground_speed'] = float(request_received.POST.get('ground_speed'))
  if request_received.POST.get('air_speed') != None:
    new_dict['air_speed'] = float(request_received.POST.get('air_speed'))
  if request_received.POST.get('heading') != None:
    new_dict['heading'] = float(request_received.POST.get('heading'))
  if request_received.POST.get('battery_percent') != None:
    new_dict['battery_percent'] = float(request_received.POST.get('battery_percent'))
  if request_received.POST.get('ready_to_arm') != None:
    new_dict['ready_to_arm'] = (request_received.POST.get('ready_to_arm') == 'True')
  if request_received.POST.get('device') != None:
    new_dict['device'] = request_received.POST.get('device')
  if request_received.POST.get('data') != None:
    new_dict['data'] = request_received.POST.get('data')
  
  if request_received.POST.get('ip') != None:
    new_dict['ip'] = request_received.POST.get('ip')
  else:
    print('Não há ip base')
    new_dict['ip'] = ip
  return new_dict


@csrf_exempt 
@async_to_sync
async def post_to_socket(request):
  # Receives a POST request with information on it's body
  # Start ACK with an error code on type (101?).
  # If the post is sent to the consumer, the type is 103.
  ack = {"id": 1, "type": 101, "seq": 0, "lat": 0, "lng": 0, "alt": 0, "DATA": "0"}

  if request.method == 'POST':
    new_dict = create_new_dict(request)

    post_consumer_instance = get_post_consumer_instance()
    if post_consumer_instance is not None:
      await post_consumer_instance.receive_post(new_dict)
      ack['type'] = 103

  return JsonResponse(ack)

@csrf_exempt
def send_uav_ip(request):
  # Receives a POST request with the ID of an uav
  # Search the uav IP on the permanente devices list and send it back

  if request.method == 'POST':
    id = json.load(request)['id']
  else:
    print(f'No POST request {request.POST}')
    id = 'all'
  
  device = get_device_from_list_by_id(id)
  if id == 'all':
    ip = config['uav-simulator']['ip_uav_server']
  else:
    ip = device[0]['ip']

  return JsonResponse({'ip': ip})


from django.http import HttpResponseNotAllowed
from .models import Marking


@csrf_exempt
def markings(request):
  # Listar e criar. O projeto inteiro é csrf_exempt (os drones postam sem token),
  # e uma exceção aqui só pra esta rota seria inconsistente sem ganhar nada.
  if request.method == 'GET':
    return JsonResponse({
      'markings': [m.as_dict() for m in Marking.objects.order_by('id')]
    })

  if request.method == 'POST':
    try:
      body = json.load(request)
    except ValueError:
      return JsonResponse({'error': 'Corpo não é JSON'}, status=400)

    kind = body.get('kind')
    color = body.get('color', 'slate')

    # Validado no servidor porque o que o navegador manda não é confiável: uma
    # cor fora da paleta viraria um marcador sem fill, invisível no mapa.
    if kind not in dict(Marking.KINDS):
      return JsonResponse({'error': f'Tipo inválido: {kind}'}, status=400)
    if color not in dict(Marking.COLORS):
      return JsonResponse({'error': f'Cor inválida: {color}'}, status=400)

    try:
      lat = float(body['lat'])
      lng = float(body['lng'])
    except (KeyError, TypeError, ValueError):
      return JsonResponse({'error': 'lat e lng são obrigatórios e numéricos'}, status=400)

    marking = Marking.objects.create(
      kind=kind, lat=lat, lng=lng, color=color,
      label=str(body.get('label', ''))[:120],
    )
    return JsonResponse(marking.as_dict(), status=201)

  return HttpResponseNotAllowed(['GET', 'POST'])


@csrf_exempt
def marking_detail(request, marking_id):
  if request.method != 'DELETE':
    return HttpResponseNotAllowed(['DELETE'])

  deleted, _ = Marking.objects.filter(id=marking_id).delete()
  if deleted == 0:
    return JsonResponse({'error': 'Marcação não encontrada'}, status=404)
  return JsonResponse({'deleted': True})
