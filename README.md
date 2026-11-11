# PlatformIO Wokwi ESP32

A reusable ESP32 DevKit starter project for PlatformIO, Wokwi and Velxio.

Use this repository as a base for ESP32 projects that need local development with PlatformIO and circuit simulation with Wokwi or Velxio. It works in VS Code and in Zed.

> The LittleFS data upload workflow (PlatformIO configuration, Linux/Windows scripts, and Zed/VS Code/mise tasks) is available on the [`feat/littlefs-filesystem-tasks`](https://github.com/gm64x/platformio-wokwi-esp32/tree/feat/littlefs-filesystem-tasks) branch and has not yet been merged into `main`.

## Included

- PlatformIO configuration for the ESP32 DevKit (`esp32dev`), pinned to the official `platformio/espressif32 @ 7.1.3` platform (arduino-esp32 2.0.17). For arduino-esp32 3.x see the `dev/arduino-3` branch
- Arduino framework, serial monitor at 115200 baud
- Wokwi simulation with an ESP32 DevKit C v4 wired to the serial monitor
- Velxio simulation from a merged 4 MB flash image built on every `pio run`
- VS Code and Zed task configurations, plus clangd setup
- `mise.toml` with pinned `pio` and `wokwi-cli`
- Standard PlatformIO project structure

## Use as a template

Click **Use this template** on GitHub, or create a new project from the terminal:

```bash
gh repo create my-project --template gm64x/platformio-wokwi-esp32 --public --clone
```

Looking for the Arduino Uno version? See [platformio-wokwi-arduino-uno](https://github.com/gm64x/platformio-wokwi-arduino-uno).

## Getting started

This project works best in conjunction with [Visual Studio Code](https://code.visualstudio.com/), [PlatformIO IDE](https://marketplace.visualstudio.com/items?itemName=platformio.platformio-ide), and [Wokwi Simulator for VS Code](https://marketplace.visualstudio.com/items?itemName=Wokwi.wokwi-vscode).

Install the tools before opening the project:

1. [Install Visual Studio Code](https://code.visualstudio.com/download)
2. [Install PlatformIO IDE in VS Code](https://marketplace.visualstudio.com/items?itemName=platformio.platformio-ide)
3. [Install Wokwi Simulator in VS Code](https://marketplace.visualstudio.com/items?itemName=Wokwi.wokwi-vscode)

Clone this repository and open it in VS Code.

### Using Zed

The project also works in [Zed](https://zed.dev/) through the [PlatformIO Core CLI](https://docs.platformio.org/en/latest/core/installation/index.html) (`pio`) and, optionally, the [Wokwi CLI](https://docs.wokwi.com/wokwi-ci/cli-installation) (`wokwi-cli`, needs a `WOKWI_CLI_TOKEN`).

1. Install PlatformIO Core and make sure `pio` is on your `PATH`, or run `mise install` to get `pio` and `wokwi-cli` from `mise.toml` with [mise](https://mise.jdx.dev/)
2. Open the folder in Zed
3. Run `task: spawn` (`alt-shift-t`) and pick a task from `.zed/tasks.json`:
   - Build and upload: `Build`, `Upload`, `Upload and Monitor`, `Serial Monitor`, `Clean`, `Test`, `Program Size`, `Verbose Build`, `Static Code Analysis`, `Erase Flash`, `Erase Flash and Upload`
   - Ports: `List Devices (Serial Ports)`, `Select Port`, `Upload to Port …`, `Serial Monitor on Port …`
   - Libraries: `Search Libraries for …`, `Install Library …`, `Uninstall Library …`, `List Installed Packages`, `Check Outdated Packages`, `Update Packages`
   - Other: `Search Boards for …`, `System Info`, `Open PIO Home`, `Generate compile_commands.json (clangd)`
   - `Wokwi: Simulate` (build first)
4. Run the `compile_commands.json` task once (and again after changing `platformio.ini` or libraries) so clangd can resolve `Arduino.h` and the ESP32 headers. `.clangd` removes GCC-only Xtensa flags that clang does not understand.

Build the project with:

```bash
pio run
```

The first build downloads the ESP32 toolchain and Arduino core, so it takes a while.

The Wokwi configuration uses the PlatformIO build output:

- Firmware: `.pio/build/esp32dev/firmware.bin`
- ELF: `.pio/build/esp32dev/firmware.elf`

Edit `src/main.cpp` to add your application code and `diagram.json` to add components and wiring for your simulation.

### Using Velxio

[Velxio](https://velxio.dev/) is an open-source browser simulator for Arduino, ESP32 and Raspberry Pi boards. It runs ESP32 firmware in QEMU, which boots from a full flash image instead of the app-only `firmware.bin`, so `scripts/merge_firmware.py` runs after every build and writes:

- Merged image: `.pio/build/esp32dev/firmware.merged.bin` (bootloader, partitions, `boot_app0` and app, 4 MB, DIO)

To run it in the [Velxio editor](https://velxio.dev/editor/) (free, no install):

1. Build the project with `pio run`
2. Add an **ESP32 DevKit C V4** board (or ESP32 DevKit V1) to the canvas
3. Pick **Upload firmware** from the menu, select `firmware.merged.bin` and start the simulation
4. Open the Serial Monitor to see `2 + 3 = 5`

`velxio.toml` points the [Velxio VS Code extension](https://github.com/davidmonterocrespo24/velxio/tree/master/vscode-extension) (needs a Velxio Pro subscription or trial) at the same merged image, so `Velxio: Run Simulation` loads it without compiling. Velxio has no standalone CLI, so there is no Zed task or `mise.toml` entry for it.

### Libraries and ports from Zed

Zed tasks can't ask for input, so the tasks ending in `…` use the text selected in the editor. They only show up in `task: spawn` while something is selected:

- **Find and add a library:** type a name such as `DHT` anywhere (a scratch buffer works), select it and run `Search Libraries for "DHT"`. Then select the full name from the results, e.g. `adafruit/DHT sensor library`, and run `Install Library`. It is added to `lib_deps` in `platformio.ini`.
- **Pick a port once:** run `Select Port`. It lists the serial ports, asks for a number in the terminal and saves your choice in `port.local.ini` (git-ignored), which every upload and monitor then uses. Choose `0` to go back to auto-detect.
- **Use a port just once:** select a port name such as `COM3` or `/dev/ttyUSB0` and run `Upload to Port` or `Serial Monitor on Port`.

In the task picker, `tab` lets you edit a task's command before running it, e.g. to add flags.

All of these are plain `pio` commands, so they work the same on Windows and Linux and from any terminal: `pio pkg search dht`, `pio pkg install --library "adafruit/DHT sensor library"`, `pio device list`, `pio run -t select_port`.

## Linux and Windows setup

Both setups use [mise](https://mise.jdx.dev/) to install the pinned `pio` and `wokwi-cli` from `mise.toml`. If you already have PlatformIO Core on your `PATH`, skip the mise steps.

### Linux

1. Install mise and enable it in your shell:

   ```bash
   curl https://mise.run | sh
   echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc   # or ~/.zshrc with "activate zsh"
   ```

2. In the project folder, install the tools:

   ```bash
   mise trust && mise install
   ```

3. Allow uploads to the board without `sudo` (PlatformIO udev rules and serial group), then log out and back in:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/platformio/platformio-core/develop/platformio/assets/system/99-platformio-udev.rules | sudo tee /etc/udev/rules.d/99-platformio-udev.rules
   sudo udevadm control --reload-rules && sudo udevadm trigger
   sudo usermod -a -G dialout $USER   # on Arch-based distros the group is "uucp"
   ```

4. Optional: install Zed with `curl -f https://zed.dev/install.sh | sh`.
5. Optional, for `wokwi-cli`: `export WOKWI_CLI_TOKEN=<token>` (add it to `~/.bashrc` to keep it).

The board shows up as `/dev/ttyUSB0` (CP210x/CH340) or `/dev/ttyACM0`. **WSL:** build and simulate inside WSL, but USB devices are not visible there by default. Upload from Windows, or attach the board with [usbipd-win](https://learn.microsoft.com/windows/wsl/connect-usb).

### Windows

1. Install mise from PowerShell, with `winget install jdx.mise` or `scoop install mise`.
2. Make the tools available in every terminal: add `%LOCALAPPDATA%\mise\shims` to your user `PATH`, or add `mise activate pwsh | Out-String | Invoke-Expression` to your PowerShell `$PROFILE`.
3. In the project folder, install the tools:

   ```powershell
   mise trust; mise install
   ```

4. Install the USB-to-serial driver if Windows doesn't detect the board: ESP32 DevKit boards use a CP210x ([Silicon Labs driver](https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers)) or CH340 ([WCH driver](https://www.wch-ic.com/downloads/CH341SER_EXE.html)) chip; check the chip near the USB connector.
5. Optional: install [Zed for Windows](https://zed.dev/download).
6. Optional, for `wokwi-cli`: `setx WOKWI_CLI_TOKEN "<token>"`, then open a new terminal.

The board shows up as a `COM` port (for example `COM3`). Check **Device Manager > Ports (COM & LPT)** or run `pio device list`.

PlatformIO picks the upload port automatically on both systems. To choose one, run `pio run -t select_port` (or the `Select Port` Zed task), or add `upload_port = COM3` (Windows) or `upload_port = /dev/ttyUSB0` (Linux) to the `[env]` section of `platformio.ini`.

## PBL 03 — ESP32 + PHP + MariaDB

One or more ESP32 boards read temperature and humidity and POST a reading every 10 seconds to a PHP webservice. The webservice checks the API key, stores the reading in the MariaDB table `medicoes` with the sender's `device_id`, and a dashboard page shows each device separately.

```
DHT11/DHT22 ──► ESP32 (device_id) ──HTTP POST──► post-esp-data.php ──► MariaDB (medicoes)
                                                                           │
                                       browser ◄── esp-data.php (+ JSON) ◄─┘
```

### Files

- `src/main.cpp`: ESP32 firmware (Wi-Fi, DHT reading, device ID, POST every 10 s)
- `include/secrets.example.h`: credentials and options template (committed). Copy it to `include/secrets.h`, which is git-ignored
- `docker-compose.yml`: `web` (PHP 8 + Apache, port 8081) and `db` (MariaDB 11, not published on the host)
- `webservice/post-esp-data.php`: receives the POST, validates the API key, validates `device_id`, and inserts with a prepared statement
- `webservice/esp-data.php`: the dashboard page and its JSON endpoints
- `webservice/app.js`: dashboard logic (device list, charts drawn as SVG, polling)
- `webservice/style.css`: dashboard styles (light and dark theme)
- `webservice/bd.sql`: creates the `dbesp32mysql` database and the `medicoes` table (new installations)
- `webservice/migrate-001-device-id.sql`: adds `device_id` to an existing database
- `webservice/create-user.sql`, `docker/mariadb/02-create-user.sh`: database user with `SELECT, INSERT` only (plus `DELETE` on `medicoes` when `SIMULATION=1`)
- `.env.example`: passwords and API key for Docker. Copy it to `.env`, which is git-ignored

### Real board vs. simulation

The firmware has one switch, `SIMULATION`, in `include/secrets.h`. The default is the real board (`0`). Everything else follows from it.

| | `SIMULATION 0` (real board, default) | `SIMULATION 1` (Wokwi / Velxio) |
|---|---|---|
| `device_id` | `esp32-` + last 6 hex digits of the Wi-Fi MAC, e.g. `esp32-a1b2c3` | random from a fixed list + 2 hex digits, e.g. `esp32-sala-3f`, saved in NVS |
| `local_instalado` | `SENSOR_LOCAL` from `secrets.h` (default `Sala`) | the random place from the list (`sala`, `quarto`, `cozinha`, `garagem`, `varanda`, `escritorio`) |
| Sensor | DHT11 (`sensor = "DHT11"`) | DHT22 (`sensor = "DHT22"`) |
| Wi-Fi | your network (`SUA_REDE_WIFI`) | `Wokwi-GUEST`, empty password |

The Wokwi part in `diagram.json` is `wokwi-dht22`. It only matches `SIMULATION 1`: with `SIMULATION 0` the firmware expects a DHT11, which would read wrong values from the simulated DHT22.

Two options work in both modes and override the rest:

- `DEVICE_ID_OVERRIDE` (`""` = not used): a fixed `device_id`, letters, digits, `_` or `-`, up to 40 characters
- `DEVICE_NAME` (`""` = not used): a nickname printed on the Serial monitor only. It is not stored

Priority for the ID: `DEVICE_ID_OVERRIDE`, then `SIMULATION` (random/NVS in mode 1, MAC in mode 0).

**NVS caveat (simulation).** In mode 1 the random ID is kept in the ESP32 NVS (namespace `device`). On a real board it stays the same across reboots. In simulators the NVS is probably erased when a new simulation starts, so each new run may get a new random ID. Within one run, and after resets, the ID stays the same.

On boot the firmware prints (ASCII, `\r\n`) the mode (`REAL` or `SIMULACAO`), the sensor, the `device_id`, its origin (`MAC`, `NVS`, `sorteio` or `DEVICE_ID_OVERRIDE`), the local and the nickname.

### Database migration (existing database)

New installations get `device_id` from `bd.sql`. A database created before this change needs the migration, which can be run more than once:

```bash
docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" dbesp32mysql' < webservice/migrate-001-device-id.sql
```

The password comes from the container environment (`MARIADB_ROOT_PASSWORD`). Old rows get `device_id = 'desconhecido'`, which the dashboard shows as "sem id (legado)". Old firmware, which does not send `device_id`, keeps working and is stored the same way.

Empty values and the text `NULL` (any case) are stored as SQL `NULL`. The dashboard shows them as `—`. The `valor 3` column is only shown when some visible reading has a value for it.

### Run the webservice with Docker

Prerequisites: Docker with Compose v2, and the ESP32 on the same network as the computer that runs Docker.

1. Create the environment file and set real values for the passwords and the API key:

   ```bash
   cp .env.example .env
   ```

2. Start the containers:

   ```bash
   docker compose up -d --build
   ```

3. Open the dashboard: <http://localhost:8081/esp32mysql/esp-data.php>. It is empty until the first reading arrives.

On the first start, MariaDB runs `bd.sql` and creates the user. These scripts only run when the `db-data` volume is empty. To start from scratch, run `docker compose down -v` and then `docker compose up -d --build` again.

Test the POST with curl (use the same API key as in `.env`). `device_id` is optional:

```bash
curl -i -X POST "http://localhost:8081/esp32mysql/post-esp-data.php" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "api_key=YOUR_API_KEY&sensor=DHT22&local_instalado=Sala&valor1=24.5&valor2=50&valor3=NULL&device_id=esp32-a1b2c3"
```

Expected result: `HTTP/1.1 200 OK` and `Novo registro foi inserido com sucesso!`. A wrong key returns `401`, and a `device_id` that is missing or invalid is stored as `desconhecido`.

To stop the containers and delete the database volume (this deletes all readings):

```bash
docker compose down -v
```

### Configure and flash the ESP32

1. Copy the credentials template and fill it in:

   ```bash
   cp include/secrets.example.h include/secrets.h
   ```

   - `SIMULATION`: `0` for a real board, `1` for Wokwi/Velxio
   - `WIFI_SSID` and `WIFI_PASSWORD`: your network (`Wokwi-GUEST` and empty in simulation)
   - `SERVER_HOST`: the LAN IP of the computer running Docker, with port 8081, e.g. `"http://192.168.0.10:8081"`. Do not use `localhost`, because that points to the ESP32 itself. Wokwi cannot reach a LAN address (see below)
   - `API_KEY_VALUE`: the same value as `API_KEY` in `.env`
   - `SENSOR_LOCAL`: the place name for a real board (`Sala`, `Quarto`, ...)
   - `DEVICE_NAME`, `DEVICE_ID_OVERRIDE`: optional, see above

2. Compile, flash, and open the serial monitor:

   ```bash
   pio run                  # build
   pio run -t upload        # flash (use pio run -t select_port to choose the port)
   pio device monitor       # serial monitor at 115200 baud
   ```

Expected serial output on a real board:

```
Modo: REAL
Sensor: DHT11
ID do dispositivo: esp32-a1b2c3
Origem do ID: MAC
Local: Sala
Apelido: esp32-a1b2c3
Conectando a rede Wi-Fi: <your SSID>
Conectado. IP do ESP32: 192.168.x.x
Enviando: api_key=...&sensor=DHT11&local_instalado=Sala&valor1=24.00&valor2=50.00&valor3=NULL&device_id=esp32-a1b2c3
Codigo da resposta HTTP: 200
Novo registro foi inserido com sucesso!
```

A reading of `--` means the sensor did not respond. It is stored as a missing value.

### Several ESP32 boards

Every board that uses the same `SERVER_HOST` and `API_KEY_VALUE` is a new device as soon as it has a different `device_id`. To add a board:

1. Flash it with `SIMULATION 0`. Its ID comes from its own MAC, so no change is needed.
2. Set `SENSOR_LOCAL` in its `secrets.h` to the place name (it is stored in `local_instalado`).
3. It appears in the dashboard list after its first reading.

To simulate several devices in Wokwi, use `SIMULATION 1` (random ID per simulation, or `DEVICE_ID_OVERRIDE` for a fixed name in each simulation). For example, two simulated boards with `DEVICE_ID_OVERRIDE` set to `esp32-sala` and `esp32-quarto` appear as two separate devices. Simulators often share one MAC, so use `DEVICE_ID_OVERRIDE` when you need a stable ID.

### Simulate on Wokwi or Velxio

The circuit is in `diagram.json`: an ESP32 DevKit C v4, a half breadboard and a `wokwi-dht22`. `3V3` (red) and `GND` (black) go to the breadboard power rails, a red and a black jumper carry them from the rails to the DHT22 `VCC` and `GND`, and the data wire (green) goes from `D4` (GPIO 4) straight to `SDA`. Wokwi has no DHT11 part, so use `SIMULATION 1` (DHT22). On real hardware with a DHT11 and the same pinout, keep `SIMULATION 0`. A 10 kΩ pull-up between `SDA` and `3V3` is needed if the module does not have one.

- **Wokwi** (`wokwi.toml`): run `pio run`, then start the simulation from the Wokwi extension in VS Code or with `wokwi-cli`. Wokwi runs in the cloud, so it cannot reach `localhost` or a LAN IP. Expose port 8081 with a tunnel such as ngrok or Cloudflare Tunnel, and set `SERVER_HOST` to the tunnel's public URL. Without it, the POST fails with `Erro na requisicao HTTP`.
- **Velxio** (`velxio.toml`): uses the `firmware.merged.bin` image created by `pio run`. The simulated network must also reach the server.

### Dashboard

`esp-data.php` shows:

- **Devices** (list, or a horizontal strip on narrow screens): device ID, place, sensor, and online/offline with the time since the last reading. A device is online when its last reading is less than 30 seconds old. The state is shown as text and a filled or hollow square. Old rows appear as "sem id (legado)". "Todos" shows all devices.
- **Current reading**: temperature and humidity in large monospace numbers for the selected device, or a table with the latest reading of every device under "Todos".
- **Period**: 15 min, 1 h, 24 h or all. The period and the selected device are kept in the URL hash (`#dispositivo=esp32-a1b2c3&periodo=1h`).
- **Min / max / average** for the period, per device.
- **Temperature and humidity charts** drawn as SVG by plain JavaScript (no libraries), with axes, fine grid lines, a tooltip on hover or touch, and automatic scale. Temperature is a solid line; humidity is a dashed line. Under "Todos" each device has its own line and legend entry. Charts start at the first reading when the period has less data than the window.
- **Readings table**: the latest 200 readings. Device IDs in the table are buttons that select that device, the same as the list.

The page checks for new readings every 2 seconds and only reloads the data when the latest ID changes. No page reload is needed.

Light and dark themes follow the system setting (`prefers-color-scheme`). Motion is disabled when `prefers-reduced-motion` is set.

### Endpoints

All JSON endpoints are served by `esp-data.php` with `Cache-Control: no-store`. Parameters always go through prepared statements.

| URL | Returns |
|---|---|
| `esp-data.php?latest=1` | The largest `id` (plain text). The page uses it to detect new readings |
| `esp-data.php?devices=1` | One item per device: `device_id`, `sensor`, `local_instalado`, `ultimo_id`, `t` (°C), `h` (%), `data_hora`, `total`, `idade_s` (seconds since the last reading, measured by the database) |
| `esp-data.php?series=1&device=ID\|all&since=S` | `{amostrado, passo, pontos: [{id, device_id, t, h, data_hora}]}`. `since` is in seconds (`0` = all). At most 2000 points; with more, it samples 1 in N per device and always keeps each device's latest reading |
| `esp-data.php?readings=1&device=ID\|all&limit=N` | The latest `N` readings (`N` up to 200), newest first |
| `esp-data.php?config=1` | `{"simulation": true\|false}`, from the `SIMULATION` variable. The dashboard arms the reset shortcut only when it is `true` |
| `POST esp-data.php?reset=1` | Simulation only: deletes all readings. Needs the header `X-Confirmar: apagar` (`400` without it), `405` for other methods, `403` when `SIMULATION` is not `1`. Returns `{"ok": true, "apagadas": N}` |

`device` must be `all` or a valid ID; anything else returns `400`. `data_hora` is in Brasília time (UTC-3, `-03:00` offset): the -3 h adjustment is applied only when it is shown. The database stores the original value.

#### Illustrations

The dashboard's empty and error states use SVG files in `webservice/assets/`. The page fetches them and injects them inline (not as `<img>`), so they follow the light and dark theme:

| File | Used for | Size |
|---|---|---|
| `empty-state.svg` | empty dashboard (no readings yet) | 160 px max |
| `error-sensor.svg` | "Sem leituras de temperatura/umidade" when a sensor sends no value | 120 px |
| `error-unplugged.svg` | "Sem conexão com o servidor" when the server does not answer | 160 px max |
| `stale-data.svg` | icon in the "Dados parados há X min" band (optional; the band shows only text without it) | 20 px |
| `favicon.png` | browser tab icon, 64×64 PNG (optional; a missing file breaks nothing) | 16 px |

The illustrations in the repository are raster artwork (PNG, transparent background) wrapped in SVG files with an embedded `<image>`, so the loader stays the same. They keep their own colors (light gray fill with a dark outline) and do not follow `currentColor`. If a file is missing, the page shows a short text instead (`[ vazio ]` or `[ erro ]`) and the layout keeps working.

Rules for replacing them with vector art (a pure SVG also works with the same file names):

- Square `viewBox`: `0 0 160 160` for the illustrations. `stale-data.svg` and `favicon.svg` may use `0 0 24 24` and `0 0 32 32`.
- No `width` or `height` attributes. The size comes from CSS.
- Colors only through `currentColor` and `var(--ilu-accent, currentColor)`. No fixed hex colors, so the light and dark themes keep working.
- No gradients, filters, raster images, fonts or `<text>`.
- Flat strokes of 2 to 3 px. Keep each file under 6 KB.
- Scripts and `on*` attributes are removed when the file is loaded, but do not rely on that.

#### Simulation reset (hidden shortcut)

To clear the database while you test with Wokwi or Velxio, hold **Backspace** on the dashboard for 5 seconds. The shortcut has no visible hint on the page. It only works when `SIMULATION=1` is set in `.env`:

- 0 to 2 s: nothing happens.
- 2 to 5 s: the page shakes (off with `prefers-reduced-motion`) and turns red, with a countdown 3, 2, 1.
- Release the key, switch tabs or lose window focus before 5 s to cancel.
- At 5 s: the readings are deleted and the empty dashboard is shown.

Set it up:

1. In `.env`, set `SIMULATION=1` (default `0`, see `.env.example`).
2. The database user needs `DELETE` on `dbesp32mysql.medicoes`. The script `docker/mariadb/02-create-user.sh` grants it only when `SIMULATION=1`, but it only runs on a new volume. For an existing database, run once:

   ```bash
   docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" dbesp32mysql' <<'SQL'
   GRANT DELETE ON dbesp32mysql.medicoes TO 'esp32'@'%';
   FLUSH PRIVILEGES;
   SQL
   ```

   To take it back: `REVOKE DELETE ON dbesp32mysql.medicoes FROM 'esp32'@'%';`. With `SIMULATION=0` the endpoint returns `403` even if the grant is still there.
3. Run `docker compose up -d` to apply the change. The volume is kept.

Test the endpoints:

```bash
curl -s "http://localhost:8081/esp32mysql/esp-data.php?devices=1" | python3 -I -m json.tool
```

## Project structure

```
.
├── diagram.json      # Wokwi circuit definition
├── platformio.ini    # PlatformIO configuration
├── mise.toml         # Dev tools (pio, wokwi-cli) for mise
├── wokwi.toml        # Wokwi simulation configuration
├── velxio.toml       # Velxio simulation configuration
├── scripts/          # PlatformIO helper scripts
│   ├── compiledb.py
│   ├── merge_firmware.py
│   └── port_select.py
├── .clangd           # clangd settings for Zed
├── .vscode/          # VS Code settings and tasks
└── .zed/             # Zed tasks and project settings
├── src/
│   └── main.cpp      # Application entry point
├── docker-compose.yml # PBL 03: webservice (PHP) and MariaDB
├── webservice/      # PBL 03: PHP webservice, dashboard (app.js, style.css) and SQL (ESP32 -> MariaDB)
├── include/          # Project headers
├── lib/              # Project libraries
└── test/             # PlatformIO tests
```

## License

[MIT](LICENSE)
