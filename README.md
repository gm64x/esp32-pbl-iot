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

## PBL 03 — ESP32 + PHP + MySQL

**Problema:** o ESP32 lê a temperatura e a umidade de um DHT11 (pino `GPIO4`) e envia as medições a cada 10 segundos a um Webservice PHP. O Webservice valida a API Key, trata os dados e grava na tabela MySQL `medicoes`. Uma página PHP lista todas as medições.

**Arquitetura:**

```
DHT11 ──► ESP32 ──HTTP POST (x-www-form-urlencoded)──► post-esp-data.php ──► MySQL (medicoes)
                                                                                  │
                                                     navegador ◄── esp-data.php ◄─┘
```

**Arquivos:**

- `src/main.cpp`: código do ESP32 (Wi-Fi, leitura do DHT11, envio por POST a cada 10 s)
- `include/secrets.example.h`: modelo de credenciais (commitado); copie para `include/secrets.h`
- `webservice/post-esp-data.php`: recebe o POST, valida a API Key e grava no banco com prepared statement
- `webservice/esp-data.php`: lista as medições (`ORDER BY id DESC`)
- `webservice/config.example.php`: modelo de configuração do banco e da API Key; copie para `config.php`
- `webservice/bd.sql`: cria o banco `dbesp32mysql` e a tabela `medicoes`
- `webservice/create-user.sql`: cria o usuário `esp32` com privilégios apenas sobre `dbesp32mysql.*`

**Subir o Webservice (XAMPP/Apache):**

1. Copie a pasta `webservice/` para `htdocs/esp32mysql/` (o caminho deve bater com `SERVER_PATH` no `main.cpp`).
2. Copie `config.example.php` para `config.php` e preencha a senha do MySQL e a API Key.
3. Rode `bd.sql` e depois `create-user.sql` no phpMyAdmin ou no MySQL. Troque a senha do usuário antes, e use a mesma senha no `config.php`.
4. Confira o Webservice: `http://localhost/esp32mysql/esp-data.php` deve mostrar a tabela (vazia no início).

**Configurar o ESP32:**

1. Copie `include/secrets.example.h` para `include/secrets.h` (ignorado pelo Git).
2. Preencha `SERVER_HOST` (IP ou domínio do servidor, ex.: `http://192.168.0.10`) e `API_KEY_VALUE` (igual ao `config.php`).
3. Para o Wokwi, mantenha `WIFI_SSID "Wokwi-GUEST"` e `WIFI_PASSWORD ""`. Um servidor local não é acessível pelo Wokwi sem um túnel, então use o Wokwi apenas para testar a leitura e o envio.

**Circuito (`diagram.json`):** a peça usada é o `wokwi-dht22`, porque o Wokwi não tem peça separada para o DHT11. Ela simula o DHT11 com o mesmo protocolo de um fio. Ligações: `VCC` → `3V3` (vermelho), `GND` → `GND` (preto), `SDA` → `D4` (verde). No hardware real, use um DHT11 com o mesmo pinout e um resistor de pull-up de 10 kΩ entre `SDA` e `3V3`, se o módulo não tiver um.

**Bibliotecas:** `adafruit/DHT sensor library` e `adafruit/Adafruit Unified Sensor` (em `lib_deps` no `platformio.ini`).

### Como rodar

**Pré-requisitos:** PlatformIO Core (`pio`) ou a extensão PlatformIO no VS Code/Zed; XAMPP (Apache + PHP + MySQL) para o Webservice; um ESP32 DevKit (ou o Wokwi/Velxio para simular).

**1. Subir o Webservice (PHP + MySQL):**

```bash
# No MySQL (phpMyAdmin ou terminal), na ordem:
mysql -u root -p < webservice/bd.sql
mysql -u root -p < webservice/create-user.sql     # troque a senha antes!
```

Copie `webservice/` para `htdocs/esp32mysql/` do XAMPP e crie o `config.php`:

```bash
cp htdocs/esp32mysql/config.example.php htdocs/esp32mysql/config.php
# edite: $password (senha do usuário esp32) e $api_key_value
```

**2. Configurar o ESP32:**

```bash
cp include/secrets.example.h include/secrets.h
# edite include/secrets.h: SERVER_HOST (ex.: http://192.168.0.10) e API_KEY_VALUE (igual ao config.php)
```

O `include/secrets.h` fica fora do Git. Não o commite.

**3. Compilar, gravar e acompanhar a serial:**

```bash
pio run                      # compila
pio run -t upload            # grava no ESP32 (use pio run -t select_port para escolher a porta)
pio device monitor           # serial a 115200 baud
```

Saída esperada no monitor serial:

```
Conectando a rede Wi-Fi: Wokwi-GUEST
Conectado. IP do ESP32: 192.168.x.x
Enviando: api_key=...&sensor=DHT11&local_instalado=Sala&valor1=24.00&valor2=50.00&valor3=NULL
Codigo da resposta HTTP: 200
Novo registro foi inserido com sucesso!
```

A cada 10 s surge uma nova linha, e `http://localhost/esp32mysql/esp-data.php` mostra os registros do mais recente para o mais antigo.

**4. Testar o POST sem o ESP32 (curl):**

```bash
curl -i -X POST "http://localhost/esp32mysql/post-esp-data.php" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "api_key=SUA_API_KEY&sensor=DHT11&local_instalado=Sala&valor1=24.5&valor2=50&valor3=NULL"
```

Resposta esperada: `HTTP/1.1 200 OK` e o texto `Novo registro foi inserido com sucesso!`. Com uma API Key errada, a resposta é `401` e `API Key fornecida não está compatível.`

**5. Simular no Wokwi ou no Velxio:**

- **Wokwi** (`wokwi.toml` e `diagram.json`): compile com `pio run` e abra a simulação no VS Code (extensão Wokwi) ou com `wokwi-cli`. O Wokwi roda na nuvem: o Webservice precisa estar acessível pela internet (ex.: um túnel como ngrok ou Cloudflare Tunnel apontando para o Apache). Sem isso o POST falha e o monitor mostra `Erro na requisicao HTTP`. Use `http://<host-publico>` em `SERVER_HOST`.
- **Velxio** (`velxio.toml`): usa a imagem `firmware.merged.bin` gerada pelo `pio run`. A rede simulada também precisa alcançar o servidor.

Para testar só a leitura do sensor, veja no monitor os valores de `valor1` e `valor2`. Com o DHT lendo `--`, o sensor não respondeu.

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
├── webservice/      # PBL 03: Webservice PHP e SQL (ESP32 -> MySQL)
├── include/          # Project headers
├── lib/              # Project libraries
└── test/             # PlatformIO tests
```

## License

[MIT](LICENSE)
