from telnet_connection import TelnetConnection
from convert import convert_to_mp4

import os
import netifaces as ni
import subprocess as sp
import argparse
from time import sleep


def do_sync(host, in_folder, out_folder, user="root", password="", if_name="wlan0"):
    # Authentication
    print("Connecting to {}".format(host))
    try:
        tn = TelnetConnection(host)
        tn.login(user, password, wait_after_login=0.5)
        print("Connected to host (no guarantee for successful auth)\n")
    except Exception as e:
        print("Failed to connect: {}".format(e))
        return

    # Fetch list of files
    tn.run_command("cd {}".format(in_folder))
    files = get_files_in_folder(tn, ".")
    print("Found {} files on camera memory card".format(len(files)))

    # Retrieve our IP (the address the camera should send the files to)
    local_ip_addr = get_local_ip_addr(if_name)
    print("Downloading files using local IP {}".format(local_ip_addr))

    # Download files from device
    downloaded_files = False
    port = 12346
    for file in files:
        dest_path = os.path.join(out_folder, file)
        if not os.path.exists(dest_path):
            downloaded_files = True
            src_path = os.path.join(in_folder, file)

            print()
            print("================= {} ================".format(src_path))
            print("Downloading file...")
            success = download_file(tn, src_path, dest_path, local_ip_addr, port)
            port += 1
            if not success:
                print("Download failed, removing file...")
                os.remove(dest_path)
                continue

            if src_path.lower().endswith(".asf"):
                print("Converting asf file to mp4...")
                convert_to_mp4(dest_path)

    if not downloaded_files:
        print("No new files to download")

    # Close connection
    tn.write("exit")


def get_files_in_folder(tn, folder):
    lines = tn.run_command("ls -al --color=none {}".format(folder)).split("\n")

    if len(lines) < 3:
        # First three lines should be line "total XX", folder '.' and folder '..'
        print("Warning: Weird directory found with less then 3 entries. Skipping...")
        return []

    lines = lines[3:]
    result = []
    for line in lines:
        name = " ".join(line.split()[8:])
        if " " in name:
            print("Skipping '{}'... (spaces not supported)".format(name))
            continue

        path = os.path.join(folder, line.split()[-1])
        if line.startswith("d"):
            result += get_files_in_folder(tn, path)
        else:
            result.append(path)
    return result


# Downloads file from remote device to local
def download_file(tn, src_path, dest_path, local_ip_addr, port):
    # nc -l -p [port] > [outfile]
    open_nc_port(port, dest_path)
    # nc -w 3 [host] [port] < [file]
    res = tn.run_command('nc -w 3 {} {} < {} || echo "Failure"'.format(local_ip_addr, port, src_path))
    return not 'Failure' in res


def open_nc_port(port, file):
    folder = os.path.dirname(file)
    if not os.path.exists(folder):
        os.makedirs(folder)

    outfile = open(file, 'w')
    p = sp.Popen(["nc", "-l", "-p {}".format(port)],shell=False,stdin=None,stdout=outfile,stderr=None,close_fds=False)


def get_local_ip_addr(if_name):
    return ni.ifaddresses(if_name)[ni.AF_INET][0]['addr']


def main():
    parser = argparse.ArgumentParser(description='Sync video files (.ASF) via telnet and convert to readable mp4.')
    parser.add_argument('host', type=str, help='Host to connect to, either as IP (preferred) or hostname.')
    parser.add_argument('--remote-folder', type=str, default='/mnt/mmc1', help="Remote folder where the videos are located, e.g. /mnt/mmc1")
    parser.add_argument('--sync-folder', type=str, default='web/public/synced_videos', help="Local folder where the videos are synced to, e.g. web/public/synced_videos")
    parser.add_argument('--telnet-user', type=str, default='root', help="User to supply to Telnet session")
    parser.add_argument('--telnet-pass', type=str, default='', help="Password to supply to Telnet session")
    parser.add_argument('--interface', type=str, default='wlan0', help="Interface used for network communication with camera (used to retrieve current IP address)")
    args = parser.parse_args()

    if args.interface not in ni.interfaces():
        print("Could not find given network interface '{}'.\n  Available interfaces are: {}".format(args.interface, ni.interfaces()))
        return

    do_sync(args.host, args.remote_folder, args.sync_folder, args.telnet_user, args.telnet_pass, args.interface)


if __name__ == "__main__":
    main()