# BadgerCam
This project started as a way for me to easier handle the cameras I have monitoring a barn in order to figure out the movement patterns of some unwanted badgers who are ripping up the floor (hence the name). The app provided for the cameras was horrible to use so I quickly realized a homemade solution could make my life a lot easier. Unfortunately the company I bought my cameras off were very anti this kind of solution so I will avoid publicly publishing juicy details (e.g. telnet passwords, model names etc) in order to avoid their gazing eyes at me, and I appreciate if you do the same. If you have any private questions about these details, feel free to contact me via email (see [github profile](https://github.com/mzlarsson)) or on reddit ([u/pepparkvarn](https://www.reddit.com/user/pepparkvarn)).

In its current state, the software now syncs all video files from the camera (using telnet and netcat) and displays them in a list of recordings.

## Required software
* Python 3
* Pip
* VLC
* netcat

During development I have tested with *Python v3.8.5*, *VLC 3.0.9.2-0-gd4c1aefe4d (Vetinari)* on an *Ubuntu 20.04* distro. Since this is mainly for my own personal use I have not tested with other versions, please notify me if you find any issues concerning this. Testing that everything runs smoothly on a Windows machine is on the TODO list.

## Installation
1. Clone this repo. `git clone https://github.com/mzlarsson/badgercam.git`
2. Move into the directory. `cd badgercam`
3. Install pip dependencies. `pip install -r src/requirements.txt`
4. Yay. We are ready to go!

Note: If you are doing development it might be nice to create a virtual environment and activating it before running pip install. If does sounds like mambo jambo to you, ignore it.

### TL;DR
    git clone https://github.com/mzlarsson/badgercam.git
    cd badgercam
    pip install -r src/requirements.txt 

## Running the sync manually
1. Move to the directory where you cloned the repo, e.g. `cd ~/Documents/badgercam`
2. Move into the source folder. `cd src`
3. Run sync script `python sync/sync.py [host] (options)`
    **host**: IP address (preferred) or hostname of target camera device
    Available options are as follows:
    **--remote-folder [folder]**: Folder on remote host where videos are located. Default: "/mnt/mmc1"
    **--sync-folder [folder]**: Folder on local computer to sync to. Default: "../synced_videos"
    **--telnet-user [username]**: User to login as on telnet. Default: "root"
    **--telnet-pass [password]**: Password to use for telnet. Default: ""
    **--interface**: Name of interface card connected to network you want to use. Default: "wlan0"
    **--no-device-prefix**: Don't group synced material in folder of device mac address. Default: false.
4. You can now find the downloaded and converted files in the folder you specified with --sync-folder. By default this will be in the *synced_videos* folder in base directory of repository.

Example usage:

    python sync/sync.py 192.168.100.2 --remote-folder /mnt/mmc1 --telnet-pass secret_pw_here --interface wlp2s0

Note: The default settings for --sync-folder assumes you are running this script from the src folder of the repository. If you are not, please adjust that input option to make sure the videos are synced to your desired location.

## Running the web page
TODO. The development of the web page is in progress.

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

