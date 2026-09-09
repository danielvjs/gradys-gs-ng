# Gradys Ground Station
Web application, from Project GrADyS, to monitor, control and display mobile devices networks in field tests

# Introduction
This is a repository for the Ground Station framework, developed for the GrADyS project and future IoT projects. It's an extensible and reusable framework to help visualize the location and activity status of interconnected network nodes, monitor and store the flow of data and send commands to a set of devices with different protocols. According to the project's needs, the framework is extensible, introducing ways to insert new buttons, commands, protocols, and functionalities.

![Current interface: fleet panel, telemetry and commands on the left, Leaflet map with one icon per vehicle type on the right](/readme_images/mainInterface.png)

The station talks HTTP with one [`vehicle_api`](https://github.com/beswarmdev/vehicle_api) process per vehicle, which in turn speaks MAVLink to ArduPilot (real or SITL). Telemetry comes in through `POST /update-info/`; commands go out as HTTP requests to each vehicle's API.

<details>
<summary>Previous interface (Google Maps era)</summary>

![Main showcase](/readme_images/mainShowcase.gif)

![Main showcase 2](/readme_images/mainShowcaseNew.gif)
</details>

# Installation
## Prerequisites
In order to use the components in this repository, you need to have Python 3.10 or higher installed (tested on 3.12). Also pip, a Python package manager, is recomended to manage and automatically install the required packages of this project. 
To install Python on Windows, [follow these instructions](https://docs.python.org/3/using/windows.html).
After installing Python, pip should be installed by default. You can check if it's already installed and it's version:
```console
C:\> python3 -m pip --version
```
If not installed or need to updgrade, you can get more information [here](https://pip.pypa.io/en/stable/getting-started/).

## Cloning the repository
With Python3 installed, you should be able to clone this repository. [More information on how to clone](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository).

## Creating a virtual environment
In order to keep this framework in a separate environment, with it's own packages and versions, it's recommended to create a virtual environment. On Windows:
```console
Windows
C:\> python3 -m venv C:\path-to-this-cloned-repository/venv
```
On Linux, you can check if virtualenv is already installed, install it, if not already installed, and create the venv:
```console
Linux
gradys-gs$ virtualenv --version
  virtualenv xx.x.x
gradys-gs$ sudo pip3 install virtualenv
gradys-gs$ virtualenv venv
```

This will create a folder called *venv*, inside the project's folder. Now you have to activate the environment to install/use packages only from this venv.
```console
Windows
C:\> C:\path-to-this-cloned-repository\venv\Scripts\activate
```
```console
Linux
gradys-gs$ source venv/bin/activate
```

If you need more information about virtual environments with python, it [can be found here](https://packaging.python.org/guides/installing-using-pip-and-virtual-environments/#creating-a-virtual-environment).

## Installing necessary packages
The list of necessary packages is in **requirements.txt**. The same file works on Windows and on Linux — every pinned dependency is cross-platform, so there is no longer a separate Linux file.

```console
Windows
C:\path-to-this-cloned-repository\> pip3 install -r requirements.txt
```
```console
Linux
gradys-gs$ pip3 install -r requirements.txt
```

> Older revisions of this project shipped `requeriments.txt` and `requeriments_linux.txt` (note the misspelling). Both were removed — they pinned 2021 versions that no longer install on current Python. Use `requirements.txt`.

## Secret variables
The map runs on **Leaflet + OpenStreetMap**, which needs no API key and no billing account, so the only secret you have to provide is Django's.

You can [generate your Django secret key here](https://djecrety.ir/).

<!--ts-->
  * Create a file named */config/.env* and insert:
    * SECRET_KEY='xxxx'
    *Changing xxxx with your Django secret key*
    * You shall maintain the ' ' from the 'xxxx'
<!--te-->

> **No Google Maps key is required.** Earlier versions loaded the Google Maps JavaScript API, which needs a key tied to a Google Cloud billing account, and the server refused to start without it. `GOOGLE_MAPS_API_KEY` is still read if present, but it is optional and unused.

# Usage

## Running the server
Django provides lightweight development Web server, that you can use via manage.py file. By default, the server runs on port 8000 on the IP address 127.0.0.1 and should not be used on production.
You can run with:
```console
Windows
C:\path-to-this-cloned-repository\> python3 manage.py runserver
```
```console
Linux
gradys-gs$ python3 manage.py runserver
```
Or, with diferent IP/PORT, in the example below, Port 8000 on IP address 0.0.0.0. This IP is will listen to all IP adresses the machine supports. So for example, with this server configuration up, you can open the web navigator with localhost:8000 and the inet ip obtainable from ifconfig (linux environment):
```console
C:\path-to-this-cloned-repository\> python3 manage.py runserver 0.0.0.0:8000
```
Remember to insert, inside config.ini file, the correct IP + Port, on the `[server]` section (`ip_groundstation_server`), if changed to a specific IP, when running the command above. The page reads this value to know where to open its WebSockets.

> **To see something on the map** you need a vehicle reporting telemetry. The vehicle side lives in a separate repository, [`vehicle_api`](https://github.com/beswarmdev/vehicle_api), which runs one process per vehicle (real or ArduPilot SITL) and pushes its position to this station. A simulated drone pointing at a station on the same machine is started with:
> ```console
> vehicle-api --simulated true --ardupilot_path ~/ardupilot --location AbraDF --port 8001 --sysid 1 --gradys_gs 127.0.0.1:8000
> ```
> The `uav_simulator/` folder in this repository is a legacy Flask simulator from 2022 that no longer matches the station's protocol; see the **Folders structure** section.

## Connecting to home page
Now you should be able to connect to the home page, acessing, on your browser, the IP/PORT the server is up, on default: localhost:8000.



# Project Architecture and customization

Gradys-gs's architecture was designed to make it adaptable and customizable to different needs. The functionalities are modularized, helping to customize and insert new elements, such as command buttons and communication protocols with IoT devices. Gradys Ground Station is structured following the classic concept of web development, with Front-end module, responsible for the interface and visualization, and Back-end module, responsible for server-side information processing.

The project's back-end module was built using the Python programming language, together with the use of [Django Framework](https://www.djangoproject.com/), a tool written in Python, for the agile development of a web application. This framework provides an easy-to-configure development server, a simple and extensible URL route mapping, and a highly modular architecture.

The front-end module was built using HyperText Markup Language (HTML) or [Template language](https://docs.djangoproject.com/en/3.2/ref/templates/language/), the Cascade Style styling language Sheets (CSS) and the most popular programming language in use, Javascript.
<br>
The technologies mentioned were chosen due to their wide use and popularity, contributing to a framework with more extensible usability. Python and Javascript programming languages ​​also have a vast set of libraries and packages, reflecting an extensive community.
<br>
Both modules comunicate with each other via WebSocket channels. A socket connection is a dedicated full-duplex channel based in the Transmission Control Protocol (TCP). This project uses [Django Channels](https://channels.readthedocs.io/en/stable/) library to handle WebSockets communication.

![Project Architecture](/readme_images/architecture.png)

> The diagram predates the current interface: "FlexStation" was the project's former name, and the "virtual maps" box is now Leaflet rather than Google Maps. The module layout it shows is still accurate.

As shown in Figure above, external devices can send messages to the Ground Station via the Connections sub-module. The information processing is done in the Django Channels submodule, also responsible for passing the information to the interface, through an already established WebSocket connection. Messages exchanged between the frontend and backend modules follow the JSON format. Note that the described path, from the external device to the interface, is also possible in reverse, when a command is activated on the interface.
<br>
The information gate of the ground station to external devices is through Connections submodule, which constains the routes and logic to receive/send information.


## Django

### URL/View

To understand the server-side structure of this project, first it's required a basic understanding of how Django is structured and how it operates.
Building a URL scheme with Django is a simple task, thanks to the URL/View mapping that the python web framework provides.
When a user requests a page from the URL schema, Django does a mapping to the corresponding Python function, that's called *View*.</br>
So, for example, the URL scheme below (the real one, from *connections/urls.py*) has a mapping between the **home page** path and **index** view, between ***/get-uav-ip/*** and **send_uav_ip** (returns the IP a vehicle registered, given its id), and between the path in `[post] path_receive_info` (***/update-info/*** by default) and **post_to_socket**, the view that receives the vehicles' telemetry.
```python
urlpatterns = [
    path('', index),
    path('get-uav-ip/', send_uav_ip),
    path(path_receive_info, post_to_socket),
]
```
 Inside the main app's folder, *connections*, there is *urls.py* and *views.py* files. The *urls.py* file is responsible for making the association between a URL address and a view. Note that there is another *urls.py* file, inside the *config* folder, that is responsible for the whole project's pathing. So, for example, if there was another app in our project, we could create a prefix path to that specific app. Our main app has the default path, so there's no prefix attached. 
 If you want to add a new URL path, it should be added a new path() item inside the urlpatterns list, in */connections/urls.py*. For example:
```python
urlpatterns = [
    path('', index),
    path('get-uav-ip/', send_uav_ip),
    path(path_receive_info, post_to_socket),
    path('new-path/', new_view)
]
```
Now we want a view to handle the new url path request. A view is a Python function that takes a Web request and returns a Web response. This response can be the HTML contents of a Web page, or a JSON or a redirect, or a 404 error, anything, really. The view itself contains whatever arbitrary logic is necessary to return that response.
```python
def index(request):
  context = {
    'google_maps_key': settings.GOOGLE_MAPS_API_KEY,
    'server_address': config['server']['ip_groundstation_server']
  }
  return render(request, 'index.html', context=context)
```
The example above is the **index view**, accessed when home page is loaded. It receives a request, builds a context dictionary and renders the *index.html* template with it. `server_address` is the ground station address from *config.ini*, which the page hands to the browser so the JavaScript knows where to open its WebSockets.

> `google_maps_key` is vestigial: since the map moved to Leaflet + OpenStreetMap the template no longer reads it. It is kept here only because this section documents the view as it currently stands.
We store our views inside */connections/views.py*. If you want to create the new view, it should receive a **request** and **return** something (could be anything). To send additional parameters, you can send via the url, for example, the url localhost:8000/new-path/10/, needs to be declared inside the *connections/urls.py* as integer as:
```python
path('new-path/<int:id>/', new_view)
```
And our view can receive an **id** parameter, as follows:
```python
def new_view(request, id):
  # Function Logic
  return 
```
Now, accessing the default server 127.0.0.1:8000/new-path/5/ is going to call our new_view method, sending the parameter 5.

### Routing/Consumers
Our main app form of communication with templates, or HTMLs, is using **websocket connections**. [Django Channels](https://channels.readthedocs.io/en/stable/) package mediates these connections.
The logic to stablish a websocket connection is similar with the URL/View logic presented on the topic above. The ***connections/routing.py*** file contains the websocket url patterns, or schema:
```python
ws_urlpatterns = [
  path('ws/connection/', ConnectionConsumer.as_asgi()),
  path('ws/receive/', ReceiveCommandConsumer.as_asgi()),
  path('ws/update-info/', PostConsumer.as_asgi()),
  path('ws/update-periodically/', UpdatePeriodcallyConsumer.as_asgi())
]
```
As said, Django Channels makes a mapping, associating an url with a ***Consumer***. A Consumer is a Python Class that handles a websocket connection. The four sockets above are:

| Route | Consumer | What it carries |
|---|---|---|
| `ws/update-info/` | `PostConsumer` | **The main channel.** Telemetry pushed by the vehicles goes to the browser through it, and every command the operator clicks travels back through it to be turned into an HTTP request against the vehicle |
| `ws/update-periodically/` | `UpdatePeriodcallyConsumer` | Re-sends the list of known devices every `update_delay` seconds with their activity status (`active` / `on_hold` / `inactive`), so the interface can age vehicles that went silent |
| `ws/connection/` | `ConnectionConsumer` | Serial/ESP32 link status. Only does something when `serial_available` is on in *config.ini* |
| `ws/receive/` | `ReceiveCommandConsumer` | Commands over serial. Also dormant unless the serial link is enabled |

So, when our Javascript is loaded, it opens all four, each one to a specific Consumer, accessing a specific URL, inside our ws_urlpatters.
```javascript
// Javascript stablishing new connection
var receivePostSocket = new WebSocket('ws://localhost:8000/ws/update-info/');
```
When this command is read, the PostConsumer class is called and a connection is initated.
Our Consumers are inside ***connections/consumers_wrappers/*** and a new one can be created, inheriting WebsocketConsumer or AsyncWebsocketConsumer, depending on it's functionality. You can substitute three main methods:
<!--ts-->
* **connect**: called when the specific url is accessed and start a dedicated connection with self.accept. This is the only method you NEED to override.
* **receive**: called when a message is sent via socket connection.
* **disconnect**: called when the connection is closed.
<!--te-->

Creating a new Consumer, is simple as creating a new file inside **connections/consumers_wrapper/** with a Class like:
```python
class NewConsumer(AsyncWebsocketConsumer):
  async def connect(self):
    await self.accept()

  async def receive(self, message):
    # Handle the message

  async def disconnect(self, close_code):
    # Handle disconnection

  async def additional_method(self, *args):
    # Additional method's logic
```
To send a message to the other side of connection (Django -> Javascript) it can be done using the ***send*** method, inherted from WebSocket class:
```python
await self.send(data)
```
Creating the new path can be done adding a new path to ws_urlpatters list:
```python
ws_urlpatterns = [
  path('ws/connection/', ConnectionConsumer.as_asgi()),
  path('ws/receive/', ReceiveCommandConsumer.as_asgi()),
  path('ws/update-info/', PostConsumer.as_asgi()),
  path('ws/update-periodically/', UpdatePeriodcallyConsumer.as_asgi()),
  path('ws/new-socket/', NewConsumer.as_asgi()),
]
```
Finnaly, accessing ws://localhost:8000/ws/new-socket/, a dedicated full-duplex connection should be stablished and our two ends can communicate with each other.

## Front-end
Our front-end consists of templates files, CSS styling files and Javascript files.
The home page template file is rendered when the default ip+port is accessed, as showed above. New templates files can be added inside the **/templates/** folder. They work very similarly to HTML files, with some add-ons. 
```html
{% load static %}
<link rel="stylesheet"  href="{% static 'connections/css/connection.css' %}">
```
The code above introduces the '{% %}' tag (that's not HTML native), in this case, to load a css file to the page.
For more information about [templates, you can access here](https://docs.djangoproject.com/en/3.2/topics/templates/).
To load a Javascript file in a template, the logic is the same, as long this Javascript file is inside the folder that ***STATIC_URL variable*** is pointing to. This variable is inside **config/settings.py**. In our case STATIC_URL variable is pointing to /static/ folder.
```python
STATIC_URL = '/static/'
```
Our ***index.html*** home page template loads three things from `static/connections/`:

* ***vendor/leaflet/*** — the [Leaflet](https://leafletjs.com/) map library, served locally so the station works without reaching a CDN.
* ***js/gmap.js*** — the map layer: creates the Leaflet map over OpenStreetMap tiles, holds the vehicle glyphs (one SVG per vehicle type) and exposes `gmap.newMarker()` to draw or move a vehicle. The file keeps its old name from the Google Maps era so the rest of the code did not have to change. The map itself needs internet for the tiles; everything else (fonts, icons, Leaflet) is served from this repository.
* ***js/main.js*** — opens the WebSocket connections with the back-end, keeps the per-vehicle state (`droneInfo`), and renders the three panels of the interface.

The map opens centred on *AbraDF* (the SITL home used across the project, in Brasília). A layer control in the top-right corner switches the basemap between **Claro** (OpenStreetMap desaturated in CSS, the default), **OSM** and **Topo**; adding another provider is one more entry in the `BASEMAPS` object of *gmap.js*.

The interface is a single page with a **rail** on the left, a **panel** and the **map**. The rail switches the panel between:

| Panel | What it does |
|---|---|
| **Fleet** | One row per vehicle with name, movement state, altitude, battery and arming readiness. Clicking a row selects it: the telemetry readout below shows that vehicle and the command buttons target it. The `TARGET` line above the buttons always says who will receive the next click. The default target is *All drones* (broadcast) |
| **Scripts** | Upload a `.py` script to the vehicle, list the scripts stored there, execute one, see what is running and stop it. The running list is polled every 5 s while this panel is open, and each `Stop` button targets the vehicle of that row, not the fleet selection |
| **Logs** | Every command sent (`TX`) and every answer received (`RX`), with JSON highlighted. Position pings and the running-scripts poll are deliberately not logged. The badge on the rail icon counts messages that arrived while another panel was open, red if one of them was an error |

The visual identity (colours, typography, why the chrome is dark and the map is light) is documented in [DESIGN.md](DESIGN.md).

To start a websocket connection, you have to create a new object, sending an available URL in the routing schema (see Routing/Consumers topic).
```javascript
var receivePostSocket = new WebSocket('ws://localhost:8000/ws/update-info/');
```
This object has methods to interact with the socket connection. Here are the main:
<!--ts-->
* **send**: Transmits data to the server via the WebSocket connection.
```javascript
socket.send(jsonToSend);
```
* **readyState**: The current state of the connection, this is one of the [Ready state constants](https://developer.mozilla.org/pt-BR/docs/Web/API/WebSocket#ready_state_constants). Read-only.
```javascript
if (socket.readyState == WebSocket.OPEN) {
    // Handle connection OPEN
}
```
* **onclose**: An event listener to be called when the readyState of the WebSocket connection changes to CLOSED.
```javascript
socket.onclose = function(e) {
  // Handle connection closed
};
```
* **onmessage**: An event listener to be called when a message is received from the server. Receives a message parameter.
```javascript
socket.onmessage = function(msg) {
  // Handle message received
}
```
<!--te-->

## External Communication
The primary purpose of this framework is to exchange information with other devices. The way it is done today is **HTTP**: vehicles push telemetry to the station with POST requests, and the station sends commands back with GET/POST requests against each vehicle's own API. The station never speaks MAVLink; that is the job of [`vehicle_api`](https://github.com/beswarmdev/vehicle_api), one process per vehicle.

There is also a second, optional path: a serial link to an ESP32 microcontroller plugged into the station's machine, which retransmits messages over UART. It is **disabled by default** (`serial_available = false` in config.ini) and the interface does not send commands through it; it is kept for projects that need it and is described in the **Communicating with external devices** section below.

A device, an UAV (drone) per se, wants to send its location to our ground station. This can be achieved with a POST request to the specific ground station URL (`/update-info/` by default), with **form-encoded** fields (the view reads `request.POST`, not a JSON body). This is what `vehicle_api` sends on every tick of `--gradys_gs_rate`:

```python
telemetry = {
  "id": 1,                  # vehicle id (the MAVLink sysid); used as the key in the fleet list
  "type": 102,              # 102 = position update (see [internal-protocol] in config.ini)
  "seq": 30,
  "lat": "-15.840081",
  "lng": "-47.926642",
  "alt": "12.4",            # metres above home
  "ground_speed": "3.1",    # m/s
  "air_speed": "3.3",       # m/s
  "heading": "87.0",        # degrees; the map icon rotates to it
  "battery_percent": "82",
  "ready_to_arm": True,     # the view compares the string to 'True'
  "device": "uav",          # vehicle type, free-form string; decides the map icon
  "ip": "127.0.0.1:8001/",  # where the station sends commands back to. MUST end with '/'
}

r = requests.post("http://127.0.0.1:8000/update-info/", data=telemetry)
```

`id`, `type` (must be `102`), `lat`, `lng` and `device` are required for the message to be treated as a position update; the other telemetry fields are optional and show as `—` in the fleet list when missing. The station builds command URLs as `"http://" + ip + endpoint`, and the endpoints in `[commands-list]` have no leading slash, so **`ip` has to end with a slash** (`127.0.0.1:8001/`); without it the station would request `http://127.0.0.1:8001telemetry/gps`. `vehicle_api` already sends it that way.

### Vehicle types and what the map shows
The `device` field is not an enum on either side. The station normalises it (lower-case, letters only) and looks for a known word in it, so `Boat`, `boat-2` and `UAV_alpha` all find the right icon:

| `device` contains | Icon | Shown in the fleet list? |
|---|---|---|
| `uav`, `copter`, `quad`, `drone` | quadcopter | yes |
| `plane`, `fixedwing`, `vtol` | fixed wing | yes |
| `boat`, `usv`, `ship`, `barco` | boat hull, seen from above | yes |
| `sub`, `rov`, `uuv`, `submarine` | ROV, seen from above | yes |
| `ugv`, `rover`, `car` | wheeled chassis | yes |
| `intruder`, `target`, `contact`, `alvo` | **red** boat, labelled `INTRUDER` | **no** |
| anything else | generic marker with a heading notch | yes |

An **intruder** is deliberately kept out of the fleet list: it is a *detection* reported by someone else, not a vehicle you can command, so it has no battery, no link and no buttons. It is drawn on the map only.

Every marker carries three independent signals, in three independent channels, so no channel means two things:

| Channel | Meaning | Source |
|---|---|---|
| **Colour** | the link: green while the vehicle keeps reporting, amber after `seconds_to_device_be_on_hold`, red after `seconds_to_device_be_inactive` | `[list-updater]` in config.ini |
| **Solid / hollow** | moving or not: `flying`/`grounded` from altitude for aircraft, `under way`/`stopped` from ground speed for boat, ROV and rover, since altitude says nothing about them | telemetry |
| **Faded, dashed ring** | the station stopped hearing from this vehicle; the label says for how long | time of last message |

Battery and arming readiness are shown in the fleet list, not on the marker. Note that the server's `active` / `on_hold` / `inactive` status measures **silence**, not the aircraft's state: an "inactive" drone is one we stopped hearing from, not one that landed.

### How a POST becomes a marker
The specific URL, to receive POSTs, is mapped to a view. So, when the device send it's location on body's request, the post_to_socket view receive the request and extracts the information from it's body. We want to send this information to our interface and also to save it in the log file. Who is responsible for both actions is the PostConsumer, inside /connections/consumers_wrapper/post_consumer.py. This way, the post_to_socket view needs to send the message to PostConsumer, getting an instance of this class and calling this Class function receive_post(message).

```python
post_consumer_instance = get_post_consumer_instance()
await post_consumer_instance.receive_post(new_dict)
```

### Sending commands to a device
Sending a message to an external device is also done by Consumers. When a command button is activated on the interface, the main.js uses the async method socket.send(), to transmit the command direct to the Consumer (back-end). The message received from the main.js, contains which device or group of devices it should be sent. It also contains the ID of the external devices that will receive the command. The first step is to search on the registered device's list for the address (IP) of the devices.

```python
device_to_send_list = get_device_from_list_by_id(device_receiver_id)
```

There is a list on config.ini mapping the commands code (integer) to a specific endpoint, that should be added to the IP+Port of the external device.

```ini
[commands-list]
20 = telemetry/gps,get
22 = telemetry/ned,get
24 = command/arm,get
26 = command/takeoff,get
28 = command/land,get
30 = command/rtl,get
42 = mission/list-scripts,get
44 = mission/upload-script,post
46 = mission/execute-script,post
48 = mission/running-scripts,get
50 = mission/stop-script/,post
```

The list contains the endpoint and the HTTP request type, if it is a GET or POST request. The endpoints are the ones exposed by `vehicle_api`; its Swagger page (`http://<vehicle-ip>:<port>/docs`) lists them all. What each code does on the interface:

| Code | Button | Notes |
|---|---|---|
| 20, 22 | `GPS`, `NED` | one-shot telemetry request, the answer goes to the log |
| 24, 26 | `Arm`, `Takeoff` | |
| 28 / 29 | `Land` toggle | 28 starts a task that keeps sending `land`; 29 cancels it (see `[checkbox-commands]`) |
| 30 / 31 | `RTL` toggle | same pattern as Land |
| 42 | refresh script list | answer type 42 fills the dropdown |
| 44 | `Submit script` | the file is sent base64-encoded and re-posted to the vehicle as multipart |
| 46 | `Execute` | body `{"script_name": ...}` |
| 48 | running scripts | polled every 5 s while the Scripts panel is open; answer type 50, never logged |
| 50 | `Stop` | body `{"script_name": ...}`, targets only the vehicle of that row; answer type 52 |

With the address complete, the command will be sent via HTTP request.

```python
command_path_list = config['commands-list'][command].split(',')
endpoint = command_path_list[0]

if command_path_list[1] == 'get':
  #GET request
  task = asyncio.create_task(self.send_get_specific_device(url, id, device['device']))
else:
  # POST request
  task = asyncio.create_task(self.send_post_specific_device(url, device['device'], id, json_to_send))
self.async_tasks.append(task)
```

Depending on the type of the request, the command will be sent and an asynchronous task will be created.

## Data persistence
One of the main features of this project is the data persistence of every event that occurred during the experiments. Log files are generated, when starting the application, and filled in as messages are received, errors are caught, commands are sent, and other events that are of importance to the experiment.

To generate the .log files, the logging package, for Python, is used. Inside /connections/utils/logger.py there is a class Logger, responsible for the persistent logic. It's possible to extend and copy this class to other modules.

When the server start, a .log file is created, inside `connections/LOGS/`, and the file's name is composed by a prefix (`post` by default, the `logging_for` argument of `Logger`) followed by the date created. The example below represents a .log file created by the station at 25/01/2026 08:18:40. These files are git-ignored.

```html
post-2026-01-25-08-18-40.log
```

To fill this file, it must be inserted in code calls of the methods from the Logger class, according to it's needs. The example above includes the code from the PostConsumer class, inside the method to handle a external message received.

```python
logger.log_info(source=source, data=data, code_origin='receive-info')
try:
  await self.send(json.dumps(data)) # Send to JS via socket
except Exception:
  logger.log_except()
```

The logger object is global and already instantiated. Two log methods are called, to save the data received and to save the Exception caught when trying to send the message to the front-end via socket.

The .log file format is specified inside the Logger class, using the syntax accepted by the Formatting class, form logging package. For more information on how to format the .log file, https://docs.python.org/3/library/logging.html#logging.Formatter.

```html
2026-08-28 18:34:18,894; uav-1; receive-info; {'id': 1, 'type': 102, 'seq': 1446, 'lat': -15.8400809, 'lng': -47.926642, 'alt': 14.998, 'ground_speed': 0.024, 'air_speed': 0.024, 'heading': 29.0, 'battery_percent': 82.0, 'ready_to_arm': True, 'device': 'uav', 'ip': '172.20.196.85:8001/', 'method': 'post', 'time': '2026-08-28T18:34:18.894268', 'status': 'active'}

2026-08-28 18:35:02,101; gs; send-get; http://172.20.196.85:8001/telemetry/gps
```

The example above has two messages, formatted with the date of the event, who triggered the event (`<device>-<id>` for a vehicle, `gs` for the station), where it was triggered (`receive-info`, `send-get`, `send-get-response`, `send-post`, `send-post-response`, `upload-post`) and the message itself.

## Sequence Diagram
The sequence message diagram below represents the messages flow between external devices and the main modules from this framework.

![Project Architecture](/readme_images/sequenceDiagram.png)

Note that the message protocol between the framework and external devices can differ from project to project, changing the way the information is delivered or the commands are handled. But, the messages flow between the back-end and front-end modules should remain similar to this diagram.
</br>
Important things to notice are:
<!--ts-->
* When a device send information to the framework, the back-end will **register** this device, if not already on the persistant list, log the information and forward to front-end, to update the interface.

* There is a Consumer in charge to keep the persistant device list, with the registred devices, inside ***/connections/consumers_wrapper/update_periodically.py***. In this Consumer, there is a task to update the activity status of the devices on the list, every X seconds, specified at *config.ini*. This is represented on the third group of messages flow in the diagram above.

* There is the possibility to create toggle buttons (`Land` and `RTL` on the interface), that will trigger a constant task while the toggle is engaged. The diagram still calls them "checkbox", which is what they were before the current interface. This is represented on the fourth group of messages flow in the sequence diagram.
<!--te-->


## Command Buttons
Another important functionality in this framework is the possibility to send commands, through the interface, to available devices.
We can register a new button inside the template, create a onClick callback function and send the command via websocket to Django (back-end).
<!--ts-->
* Create new button in ***/templates/index.html***, inside one of the `.cmd-group` blocks of the Fleet panel (or a new group, same markup)
```html
<div class="cmd-group">
  <span class="cmd-label">My group</span>
  <div class="cmd-row">
    <button type="button" class="btn" id="new-button">New Command</button>
  </div>
</div>
```

* Register an onclick function, in ***/static/connections/js/main.js***
```javascript
var newCommandNumber = 40

document.querySelector('#new-button').onclick = function(e) {
  sendCommand(newCommandNumber);
};
```
* Send to the back-end, when button is clicked. `sendCommand` already exists in *main.js*; its real signature is:
```javascript
function sendCommand(cmdNumber, buttonType = "default", data = {}, receiverOverride) {
  var jsonToSend = {
    id: 1,                                    // id of the ground station
    type: cmdNumber,                          // the command code (see [commands-list])
    button_type: buttonType,                  // "default" | "checkbox" | "upload"
    receiver: receiverOverride || selectedId, // 'all' or the id selected in the fleet list
    data: data                                // body of the POST, when the command is a POST
  };
  // ...
  if (receivePostSocket.readyState == WebSocket.OPEN) {
    receivePostSocket.send(JSON.stringify(jsonToSend));
  }
}
```
<!--te-->
Notice that the socket object must be instatiated already, and the connection 'OPEN'. Buttons inside `#commands` are disabled automatically while the link is down or no vehicle is connected, and the reason is written above them.
The corresponding Consumer will receive the message and handle, acording to it's command type.

A button can also be a **toggle**, like `Land` and `RTL`. Engaging it sends one code and the back-end starts a task that keeps re-sending that command; disengaging sends the next code (`code + 1`) and the task is cancelled. The pairs are declared in *config.ini* under `[checkbox-commands]` (`keep_sending = 28,30`, `stop_sending = 29,31`). To create one, give the button the `btn-toggle` class and an `aria-pressed` attribute, and bind it with the helper that already exists in *main.js*:
```html
<button type="button" class="btn btn-toggle" id="hold" aria-pressed="false">Hold</button>
```
```javascript
bindToggle('hold', 32, 33);   // 32 engages, 33 disengages; add 32 to [commands-list] and to [checkbox-commands]
```

The button type (`"checkbox"`) will be insert inside the JSON message, sent by main.js to the corresponding Consumer. So the Consumer will know this is not a regular command, and will create or cancel a task.

### Command button logic
You already have a button on interface that sends a command, in this case '40', to a Consumer. This Consumer will be in charge to the command logic.
</br>
Inside the <i>'receive'</i> method of this Consumer's Class, it's up to you to write the command's logic, according to your communication protocol.
</br>
When handling with **HTTP requests**, you can insert the new command to  the command's list, inside config.ini file. The Consumer can iterate this list and check the command received, mapping to the right endpoint.
```ini
[commands-list]
20 = telemetry/gps,get
22 = telemetry/ned,get
24 = command/arm,get
...
```
This list contains a number as the key to the corresponding endpoint address, that will receive the HTTP request. The type of request is represented after the comma, with no spaces. If your communication is using HTTP requests and this list, your new list, with the new command, should look like this:
```ini
[commands-list]
20 = telemetry/gps,get
22 = telemetry/ned,get
24 = command/arm,get
...
40 = new_endpoint,get
```

The endpoint is appended to the `ip` the vehicle reported in its telemetry (`http://<ip><endpoint>`, with no separator added), so it must include the full path the vehicle's API expects, without a leading slash, and the vehicle's `ip` must end with one. For a POST, whatever the interface passed as `data` to `sendCommand` is sent as the JSON body. Remember that *config.ini* is read once at import time: **restart the server** after changing it, the autoreloader only watches `.py` files.

## Communicating with external devices
The main purpose of this framework is to exchange information with other devices. There are two implemented ways for external connections: HTTP, which is the one in use, and serial, which is optional and off by default.

### Serial Connection (optional, disabled by default)
This path is kept for projects that need it, but it is not part of the current vehicle workflow: `serial_available` is `false` in *config.ini*, so `SerialConnection` is never instantiated, and the interface does not send commands through the serial socket.

The idea is plugin a ESP32 microcontroller to the framework's machine. This microcontroller should be able to detect other devices, receive and send information to them.
Our framework can stablish an UART connection with a plugged ESP32 microcontroller, receive everything is sent via serial and send commands via serial, making the microcontroller responsible for retransmiting the command.
In order to accept a connection with a ESP32 microcontroller, you need to insert the correct UART Port and baudrate, inside ***config.ini*** (see below for **Changing the code** topic and **Serial connection** subtopic).
The ***SerialConnection*** class, from */connections/serial_connector.py*, is instantiated when javascript starts a websocket connection of this type. The instantiated object keeps trying connection with the UART Port. Once a microcontroller is plugged, the interface indicates this change, and you are able to exchange information through the ESP32 microcontroller.

### POST Requests
Another way to communicate with our framework is with **POST requests**. A device, let's say an UAV (drone), wants to send it's location to our ground station. This can be achieved with a POST request to a specific URL, registered in ***config.ini*** file (see below for **Changing the code** topic and ***HTTP Requests*** subtopic). Note that the device should attach, on the message, it's own IP and PORT, so our framework can send commands back to it.
The specific URL, to receive POSTs, is mapped to a view. So, when the device send it's location on body's request, the ***post_to_socket*** view receive the request and extracts the information from it's body. We want to send this information to our interface and also to save it in the log file. Who is responsible for both actions is the ***PostConsumer***, inside */connections/consumers_wrapper/post_consumer.py*.
This way, the post_to_socket view needs to send the message to PostConsumer, getting an instance of this class and calling this Class function **receive_post(message)**.


## Changing the code
Some of the framework's informations are initialized by the *config.ini* file. Below are listed the parameters that can be changed.
### Serial connection
One way this framework can comunicate with a network is with a dedicated ESP32, using UART Protocol. The ESP device connected via serial has a specific PORT and Baudrate, that can be changed inside *config.ini* with the [serial] tag:
```python
[serial]
# The serial PORT the ESP32 is connected
port = COM4

# Rate of information transferred in the serial port
# Needs to be the same in ESP32 connection
baudrate = 115200

# If this Protocol is used
serial_available = false
```

### HTTP Requests
Another way to comunicate with nodes of the network is receiving/sending information via POST/GET Requests. Django provides a routing system that acessibles URLs trigger methods, or *Views*.
A device can send a POST request to http://127.0.0.1:8000/update-info/ (or IP/PORT running the application). Notice that a device should send inside the message it's own IP/PORT, so the application can send commands via HTTP requests.
This structure is described with more details below, on the Project Struct topic.

Inside the *config.ini* file, below the [server] and [post] tags, you can change some of the protocol's variables:
```ini
[server]
# Address of django's server, handed to the page so the browser knows where
# to open its WebSockets. If started on a different configuration, change it here.
ip_groundstation_server = http://127.0.0.1:8000/

[internal-protocol]
# 'type' value of a telemetry message that carries a position (see main.js)
position_command = 102

[post]
# Endpoint that'll receive POST requests with device's information
path_receive_info = update-info/
```

### List of devices updater
The application saves the latest messages of unique devices in a list, inside the *update_periodically_consumer.py*, for each execution. From time to time, it's sent to the front-end, via web-socket, with the activity status of each device. A device can be active, on hold and inactive, depending on the interval of it's last message.
These variables can be adjusted in the *config.ini* file, below the [list-updater] tag. On the interface, `on_hold` turns the marker and the fleet row amber and `inactive` turns them red, with a dashed ring and a "silent for N s" label:
```ini
[list-updater]
# The amount of seconds to a device be considered 'inactive'
seconds_to_device_be_inactive = 50

# The amount of seconds to a device be considered 'on hold'
seconds_to_device_be_on_hold = 25

# The amount of seconds to update the list of devices in Front-End
update_delay = 20
```




## Folders structure
    .
    ├── config              # Contains Django's configurations files
    ├── connections         # Main app folder
    ├── static              # Static js, css, images files
    ├── templates           # Files with template language (html)
    ├── uav_simulator       # LEGACY: Flask + pymavlink simulator from 2022, see note below
    ├── config.ini          # Contains project's adjustable parameters
    ├── manage.py           # Django’s command-line utility for administrative tasks
    ├── requirements.txt    # All packages and versions required (Windows and Linux)
    ├── DESIGN.md           # Visual identity: palette, typography, layout decisions
    └── README.md

> **`uav_simulator/` is not the simulator to use.** It predates `vehicle_api`, speaks a different set of endpoints (`/auto`, `/rtl`, port 5071) and expects an ArduPilot checkout at `../../sitl_sim`. It does not talk to the current station. To simulate a vehicle, run `vehicle-api --simulated true` from the [`vehicle_api`](https://github.com/beswarmdev/vehicle_api) repository, which drives ArduPilot SITL for you.

We will open the folders that require more attention:

**Connections**
This is the main app's folder, with the necessary tools to allow connections and information exchange with other devices

    .
    ├── ...             
    ├── connections
    |   ├── consumers_wrapper   # Folder with all websocket consumers
    |   |    ├── post_consumers.py               # Telemetry in, commands out (the main one)
    |   |    ├── update_periodically_consumer.py # Device list and activity status
    |   |    └── serial_consumers.py             # ESP32 serial link (optional)
    |   ├── LOGS                # Stores all .log files generated (git-ignored)
    |   ├── utils               # Auxiliary tools
    |   ├── ...
    |   ├── routing.py          # Paths for websocket connections
    |   ├── serial_connector.py # Auxiliary class to stablish/handle connection with esp32 device
    |   ├── urls.py             # Paths for views
    |   ├── views.py            # Methods called when specific url is accessed
    └── ...

**Templates**
This folder contains the files written with template language. These files can be associated with traditional HTML files, but with tags, interpreted by Django.

    .
    ├── ...             
    ├── templates
    |   ├── index.html   # Home page, runs main.js
    └── ...

**Static**
Contains static files, like Images, CSS and Javascript. Django provides django.contrib.staticfiles to help you manage them. These files can be configured inside *config/settings.py*:
```python
STATIC_URL = '/static/'
```
In the **templates files**, can be used the static template tag to build the URL for the given relative path using the configured *STATICFILES_STORAGE*:
```python
{% load static %}
<img src="{% static 'my_app/example.jpg' %}" alt="My image">
```

    .
    ├── ...             
    ├── static
    |   ├── connections   # Folder to separate the main app's static files
    |   |    ├── css      # connection.css: the whole interface, tokens at the top
    |   |    ├── fonts    # IBM Plex Sans / Mono, self-hosted (woff2) so the station works offline
    |   |    ├── images   # PNG assets. Map icons are now inline SVG in gmap.js; premadeIcons/
    |   |    |            # (numbered pins) and uavIcons/ are no longer referenced by the code.
    |   |    ├── js       # gmap.js (map + vehicle glyphs) and main.js (sockets, panels, commands)
    |   |    └── vendor   # Leaflet 1.9, served locally
    └── ...
