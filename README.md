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

The ESP32 reads temperature and humidity from a DHT11 sensor (GPIO 4) and sends a reading every 10 seconds with an HTTP POST to a PHP webservice. The webservice checks the API key, stores the reading in the MariaDB table `medicoes`, and a PHP page lists all readings.

```
DHT11 ──► ESP32 ──HTTP POST (x-www-form-urlencoded)──► post-esp-data.php ──► MariaDB (medicoes)
                                                                                 │
                                                  browser ◄── esp-data.php ◄─────┘
```

### Files

- `src/main.cpp`: ESP32 firmware (Wi-Fi, DHT11 reading, POST every 10 s)
- `include/secrets.example.h`: credentials template (committed). Copy it to `include/secrets.h`, which is git-ignored
- `docker-compose.yml`: `web` (PHP 8 + Apache, port 8081) and `db` (MariaDB 11, not published on the host)
- `webservice/Dockerfile`: PHP image with the `mysqli` extension
- `webservice/post-esp-data.php`: receives the POST, validates the API key, and inserts with a prepared statement
- `webservice/esp-data.php`: lists the readings, newest first
- `webservice/config.example.php`: database settings read from environment variables (`DB_*`, `API_KEY`), with a `localhost` fallback
- `webservice/bd.sql`: creates the `dbesp32mysql` database and the `medicoes` table
- `webservice/create-user.sql`: same `esp32` user for a MariaDB server without Docker (for example XAMPP). Change the password before running it
- `docker/mariadb/02-create-user.sh`: creates the `esp32` user with only `SELECT, INSERT` on `dbesp32mysql.*`
- `.env.example`: passwords and API key for Docker. Copy it to `.env`, which is git-ignored

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

3. Open the listing page: <http://localhost:8081/esp32mysql/esp-data.php>. It is empty at first.

On the first start, MariaDB runs `bd.sql` and creates the user. These scripts only run when the `db-data` volume is empty. To start from scratch, run `docker compose down -v` and then `docker compose up -d --build` again.

Test the POST with curl (use the same API key as in `.env`):

```bash
curl -i -X POST "http://localhost:8081/esp32mysql/post-esp-data.php" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "api_key=YOUR_API_KEY&sensor=DHT11&local_instalado=Sala&valor1=24.5&valor2=50&valor3=NULL"
```

Expected result: `HTTP/1.1 200 OK` and the text `Novo registro foi inserido com sucesso!`. A wrong key returns `401`. Refresh the listing page to see the new row.

To stop the containers and delete the database volume:

```bash
docker compose down -v
```

### Configure and flash the ESP32

1. Copy the credentials template and fill it in:

   ```bash
   cp include/secrets.example.h include/secrets.h
   ```

   - `SERVER_HOST`: the LAN IP of the computer running Docker, with port 8081, for example `"http://192.168.0.10:8081"`. Do not use `localhost`, because that points to the ESP32 itself.
   - `API_KEY_VALUE`: the same value as `API_KEY` in `.env`.
   - `WIFI_SSID` and `WIFI_PASSWORD`: your Wi-Fi network.

2. Compile, flash, and open the serial monitor:

   ```bash
   pio run                  # build
   pio run -t upload        # flash (use pio run -t select_port to choose the port)
   pio device monitor       # serial monitor at 115200 baud
   ```

Expected serial output:

```
Conectando a rede Wi-Fi: <your SSID>
Conectado. IP do ESP32: 192.168.x.x
Enviando: api_key=...&sensor=DHT11&local_instalado=Sala&valor1=24.00&valor2=50.00&valor3=NULL
Codigo da resposta HTTP: 200
Novo registro foi inserido com sucesso!
```

A new line appears every 10 seconds. The listing page shows them newest first. If a reading is `--`, the sensor did not respond.

### Simulate on Wokwi or Velxio

The circuit is in `diagram.json`. Wokwi has no DHT11 part, so the project uses `wokwi-dht22`, which uses the same single-wire protocol. Wiring: `VCC` to `3V3` (red), `GND` to `GND` (black), and `SDA` to `D4` (green). On real hardware, use a DHT11 with the same pinout and a 10 kΩ pull-up between `SDA` and `3V3` if the module does not include one.

- **Wokwi** (`wokwi.toml`): run `pio run`, then start the simulation from the Wokwi extension in VS Code or with `wokwi-cli`. Wokwi runs in the cloud, so it cannot reach `localhost` or a LAN IP. Expose port 8081 with a tunnel such as ngrok or Cloudflare Tunnel, and set `SERVER_HOST` to the tunnel's public URL. Without it, the POST fails with `Erro na requisicao HTTP`.
- **Velxio** (`velxio.toml`): uses the `firmware.merged.bin` image created by `pio run`. The simulated network must also reach the server.

### Libraries

`adafruit/DHT sensor library` and `adafruit/Adafruit Unified Sensor`, declared in `lib_deps` in `platformio.ini`.

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
├── webservice/      # PBL 03: PHP webservice and SQL (ESP32 -> MariaDB)
├── include/          # Project headers
├── lib/              # Project libraries
└── test/             # PlatformIO tests
```

## License

[MIT](LICENSE)
