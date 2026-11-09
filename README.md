# PlatformIO Wokwi ESP32

A reusable ESP32 DevKit starter project for PlatformIO, Wokwi and Velxio.

Use this repository as a base for ESP32 projects that need local development with PlatformIO and circuit simulation with Wokwi or Velxio. It works in VS Code and in Zed.

This branch (`pbl/01-http-get-weather`) contains the PBL 01 example: an ESP32 that fetches the current weather from the OpenWeatherMap API over HTTP GET and prints it to the serial monitor. See [PBL 01](#pbl-01--http-get-openweathermap) below.

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
├── include/          # Project headers
├── lib/              # Project libraries
└── test/             # PlatformIO tests
```

## PBL 01 — HTTP GET OpenWeatherMap

**Problema:** configurar o ESP32 para fazer uma requisição HTTP GET à API do [OpenWeatherMap](https://openweathermap.org/), receber um objeto JSON com o clima atual e usar os dados. O exemplo lê, a cada 10 segundos, a temperatura, a pressão, a umidade e a velocidade do vento de uma cidade.

O plano gratuito da API é suficiente. **Não diminua o intervalo de 10 segundos** (`TIMER_DELAY` em `src/main.cpp`): o plano gratuito tem limite de chamadas.

### 1. Obter a API key

1. Crie uma conta gratuita em <https://home.openweathermap.org/users/sign_up>.
2. Acesse <https://home.openweathermap.org/api_keys> e copie a sua chave.

A chave é pessoal: não a publique nem a commite. Ela pode levar alguns minutos (às vezes até algumas horas) para ficar ativa após a criação da conta.

### 2. Configurar `include/secrets.h`

As credenciais ficam em `include/secrets.h`, que está no `.gitignore` e **nunca vai para o git**. O modelo commitado é `include/secrets.example.h`:

```bash
cp include/secrets.example.h include/secrets.h
```

Edite `include/secrets.h` e preencha:

| Macro | Descrição | Exemplo |
| --- | --- | --- |
| `WIFI_SSID` | Nome da rede Wi-Fi | `Wokwi-GUEST` (simulação) |
| `WIFI_PASSWORD` | Senha da rede Wi-Fi | `""` (vazia no Wokwi) |
| `OWM_API_KEY` | Sua API key do OpenWeatherMap | `abc123...` |
| `OWM_CITY` | Cidade | `Porto` |
| `OWM_COUNTRY` | Código ISO do país | `PT` |

Para nomes com espaço, use `%20` (ex.: `Sao%20Paulo`).

### 3. Compilar, enviar e abrir o monitor serial

Pré-requisitos: [PlatformIO Core](https://docs.platformio.org/en/latest/core/installation/index.html) (`pio`) no `PATH` ou `mise install`, e a placa ESP32 DevKit conectada por USB.

```bash
pio run                    # compila (baixa a toolchain e a biblioteca Arduino_JSON na primeira vez)
pio run -t upload          # grava o firmware na placa
pio device monitor         # monitor serial em 115200 baud (Ctrl+C para sair)
```

Ou, no Zed, use as tasks `Build`, `Upload and Monitor` ou `Serial Monitor`.

### 4. Simular no Wokwi ou no Velxio

- **Wokwi:** rode `pio run` e use `Wokwi: Simulate` (VS Code) ou `wokwi-cli`. O `diagram.json` tem apenas o ESP32 DevKit C v4 e o serial monitor. Com `WIFI_SSID = "Wokwi-GUEST"` e senha vazia, o ESP32 acessa a internet pelo gateway do Wokwi.
- **Velxio:** siga a seção [Using Velxio](#using-velxio) e carregue `.pio/build/esp32dev/firmware.merged.bin`. A simulação de Wi-Fi/HTTPS depende do suporte do simulador; se a conexão falhar, teste no hardware real.

### Saída esperada

Após alguns segundos de conexão e a primeira leitura (10 s depois do boot), o monitor serial mostra algo como:

```
Conectando à rede Wi-Fi: Wokwi-GUEST
........
Conexão Wi-Fi estabelecida com sucesso!
Endereço IP: 10.10.0.2
Aguarde 10 segundos para a primeira leitura...
Código da resposta HTTP: 200
Temperatura: 18.4 °C
Pressão: 1016 hPa
Umidade: 72 %
Velocidade do vento: 3.6 m/s
```

A cada nova leitura (a cada 10 s), as quatro linhas de dados são repetidas. Se a chave ainda não estiver ativa ou estiver errada, a API responde com um erro (ex.: `A API retornou um erro: Invalid API key...`).

## License

[MIT](LICENSE)
