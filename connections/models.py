from django.db import models


class Marking(models.Model):
  """Um ponto que o operador desenhou no mapa.

  Não é dispositivo: não reporta telemetria, não tem link, não recebe comando.
  Fica no banco em vez de no navegador porque a marcação é da missão — quem
  abrir a estação de outra máquina tem que ver as mesmas.
  """

  KINDS = [
    ('pessoa', 'Pessoa'),
    ('pessoas', 'Pessoas'),
    ('interesse', 'Ponto de interesse'),
  ]

  COLORS = [
    ('red', 'Vermelho'),
    ('amber', 'Âmbar'),
    ('green', 'Verde'),
    ('cyan', 'Ciano'),
    ('violet', 'Violeta'),
    ('slate', 'Ardósia'),
  ]

  kind = models.CharField(max_length=32, choices=KINDS)
  lat = models.FloatField()
  lng = models.FloatField()
  color = models.CharField(max_length=16, choices=COLORS, default='slate')
  label = models.CharField(max_length=120, blank=True)
  created_at = models.DateTimeField(auto_now_add=True)

  def as_dict(self):
    return {
      'id': self.id,
      'kind': self.kind,
      'lat': self.lat,
      'lng': self.lng,
      'color': self.color,
      'label': self.label,
    }
