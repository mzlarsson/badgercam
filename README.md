# BadgerCam
This project started as a way for me to easier handle the cameras I have monitoring a barn in order to figure out the movement patterns of some unwanted badgers who are ripping up the floor (hence the name). The app provided for the cameras was horrible to use so I quickly realized a homemade solution could make my life a lot easier. Unfortunately the company I bought my cameras off were rather unhelpful which gave me a rough start but finally I solved it. If you have any questions about details, e.g. retrieving telnet passwords etc., feel free to contact me via email (see [github profile](https://github.com/mzlarsson)) or on reddit ([u/pepparkvarn](https://www.reddit.com/user/pepparkvarn)). Or just open a ticket, it's 2021 after all!

In its current state, the software now syncs all video files from the camera (using telnet and netcat) and displays them in a list of recordings. It also have capabilities to show live feeds from the cameras via RTSP streams. A Dockerfile is available for easy setup.

## Screenshot(s) of webpage
![Webpage in action, 2020-12-31](documentation/screenshot_20201231.png)
![Live view, 2021-01-18](documentation/screenshot_20210118.png)

## Installation option 1 - Docker
A `Dockerfile` is provided to easily set up all dependencies and start the webserver. The following code can be used to set this up. Please try to follow along since, in some cases, multiple solutions exist and you may want to use the optimal for your situation.

```bash
# Get docker, skip if you already have it.
# Note: The below example uses a Debian-based system.
# Security note: See https://docs.docker.com/engine/install/debian/#install-using-the-convenience-script before proceeding.
curl -fsSL https://get.docker.com | sudo -E bash -
sudo usermod -aG docker $(whoami)

# Get docker-compose (pick one path). Skip if you already have it.
# -- Common linux distros, non-ARM
sudo curl -L "https://github.com/docker/compose/releases/download/1.27.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
# -- ARM (Raspberry Pi etc.)
sudo apt install -y python3-pip
sudo pip3 install docker-compose

# Create folders for data
sudo mkdir /opt/badgercam
sudo chown $(whoami):$(whoami) /opt/badgercam

# Fill with basic content (sync folder and settings file)
cd /opt/badgercam
mkdir synced_videos
wget https://raw.githubusercontent.com/mzlarsson/badgercam/main/src/web/settings.json

# Download docker configs
wget https://raw.githubusercontent.com/mzlarsson/badgercam/main/Dockerfile
wget https://raw.githubusercontent.com/mzlarsson/badgercam/main/docker-compose.yaml

# Prompt to edit settings. See below for format.
nano settings.json

# Build dockerfile and run it
docker-compose up -d
```

See [Settings format](#settings-format) for all options in settings.json.

When the script is run the webpage will be published at [http://localhost:9674](http://localhost:9674).

## Installation option 2 - Manual
### Required software
* Python 3 and Pip (for syncing)
* NodeJS and npm (for web)
* VLC (for converting videos)
* netcat (for syncing)

During development I have tested with *Python v3.8.5*, *NodeJS v15.6.0*, *VLC 3.0.9.2-0-gd4c1aefe4d (Vetinari)* on an *Ubuntu 20.04* distro. Since this is mainly for my own personal use I have not tested with other versions, please notify me if you find any issues concerning this. Testing that everything runs smoothly on a Windows machine is on the TODO list.

### Setting up library dependencies
1. Clone this repo. `git clone https://github.com/mzlarsson/badgercam.git`
2. Move into the directory. `cd badgercam`
3. Install pip dependencies. `pip install -r src/requirements.txt`
4. Move into web directory. `cd src/web`
5. Install required node modules. `npm install`
6. Yay. We are ready to go!

Copy paste friendly version:
```bash
git clone https://github.com/mzlarsson/badgercam.git
cd badgercam
pip install -r src/requirements.txt
cd src/web
npm install
```

### Running the web page
The web page is a simple NodeJS app. If you are into web development, please forgive me. Sometimes the code quality falls rather low due to lack of experience of professional JS and CSS. In most cases the code will work fine though. Anyhoot, here is how you can run it.

1. Move to the directory where you cloned the repo, e.g. `cd ~/Documents/badgercam`
2. Move into the web source folder. `cd src/web`
3. Edit `settings.json` according to your needs. See [Settings format](#settings-format) for all available options.
4. Start server by running `node index.js`
5. Site will be published under [http://localhost:9674](http://localhost:9674).


### Running the sync manually (advanced usage)
Sometimes you may want to run the sync manually without using the UI in the web tool. If this is the case, this is how you do it. However, I would like to once again emphasize that this is only **for advanced usage**.

1. Move to the directory where you cloned the repo, e.g. `cd ~/Documents/badgercam`
2. Move into the source folder. `cd src`
3. Run sync script `python sync/sync.py [host] (options)`  
    **host**: IP address (preferred) or hostname of target camera device  
    Available options are as follows:  
    **--remote-folder [folder]**: Folder on remote host where videos are located. Default: "/mnt/mmc1"  
    **--sync-folder [folder]**: Folder on local computer to sync to. Default: "web/public/synced_videos"  
    **--telnet-user [username]**: User to login as on telnet. Default: "root"  
    **--telnet-pass [password]**: Password to use for telnet. Default: ""  
    **--interface**: Name of interface card connected to network you want to use. Default: "wlan0"  
    **--sync-limit**: Limit on how many downloads can be made in each batch. Default: unlimited  
    **--sync-cooldown**: Time (in seconds) between download batches if --sync-limit has been set. Default: 60.
4. You can now find the downloaded and converted files in the folder you specified with --sync-folder. By default this will be in the *web/public/synced_videos* folder (relative to where command was issued). Note that the webpage does not use the default value of --sync-folder.

Example usage:

    python sync/sync.py 192.168.100.2 --remote-folder /mnt/mmc1 --telnet-pass secret_pw_here --interface wlp2s0

Note: The default settings for --sync-folder assumes you are running this script from the src folder of the repository. If you are not, please adjust that input option to make sure the videos are synced to your desired location.

## Settings format
```
{
    "log_file": string,
    "sync": {
        "autosync": [string],
        "limit": int,
        "cooldown": int
    },
    "devices": [
        {
            "name": string,
            "interface": string,
            "ip": string,
            "mac": string,
            "remote_folder": string,
            "telnet": {
                "user": string,
                "password": string
            },
            "rtsp": {
                "port": int,
                "path": string
            }
        },
    ]
}
```

### General settings:  
**log_file**: Path to file which server logs to. Default "logs/badgercam.log".

### Sync settings:  
**autosync**: List of cronjob strings, as specified [here](https://www.npmjs.com/package/node-cron#cron-syntax). An automatic sync will trigger each time these expressions trigger. Defaults to empty list.  
**limit**: Number of downloads the sync can do on one device before waiting a particular cooldown. Default unlimited.  
**cooldown**: The cooldown (in seconds) after the download limit has been reached. Default 60 seconds.

### Device settings:  
**name**: Pretty name for the device to show in UI. Optional.  
**interface**: What interface this device is reachable through. Default wlan0.  
**ip**: IP number of the device. This field is optional but highly recommended to set. The autodetect IP feature is rather bad (see known issues).  
**mac**: MAC address of the device. Required.  
**remote_folder**: Remote folder on device that holds videos. Default /mnt/mmc1.  

#### Device -> Telnet settings: (required)  
**user**: Username when syncing over telnet. Default root.  
**password**: Password when syncing over telnet. Default empty string.  

#### Device -> RTSP settings: (optional)  
**port**: RTSP port for retrieving live feed. This information can be retrieved via ONVIF if your camera supports it. Required.  
**path**: RTSP port for retrieving live feed. This information can be retrieved via ONVIF if your camera supports it. Required.  

See [this file](https://github.com/mzlarsson/badgercam/blob/main/src/web/settings.json) to see an example.

## Known issues
### Auto-detecting IP addresses
The software auto detects the IP address by looking at the local ARP table of the server (a little lazy, I know). This means that if there have been no communication between these devices, the auto-detect IP feature will come up short. To counter this either ping the device from the server before syncing or add the IP manually in settings.json (see file for example).

## Licensing
This code is published under the MIT license.

> The MIT License (MIT)  
> Copyright (c) 2020 Matz Larsson
>
> Permission is hereby granted, free of charge, to any person obtaining a copy  
of this software and associated documentation files (the "Software"), to deal  
in the Software without restriction, including without limitation the rights  
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell  
copies of the Software, and to permit persons to whom the Software is  
furnished to do so, subject to the following conditions:  
>
> The above copyright notice and this permission notice shall be included in  
all copies or substantial portions of the Software.  
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR  
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,  
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE  
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER  
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,  
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN  
THE SOFTWARE.

