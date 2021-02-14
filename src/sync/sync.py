from telnet_connection import TelnetConnection
from convert import convert_to_mp4

import os
import netifaces as ni
import subprocess as sp
import argparse
from time import sleep


def do_sync(host, in_folder, out_folder, user="root", password="", if_name="wlan0", sync_limit=None, sync_cooldown=60):
    # Authentication
    print("Connecting to {}".format(host))
    try:
        tn = TelnetConnection(host, user, password, wait_after_login=2)
        tn.connect()
        print("Connected to host (no guarantee for successful auth)\n")
    except Exception as e:
        print("Failed to connect: {}".format(e))
        return

    # Fetch list of files
    try:
        tn.run_command("cd {}".format(in_folder))
        files = get_files_in_folder(tn, ".")
        print("Found {} files on camera memory card".format(len(files)))
    except Exception as e:
        print("Failed to list files on device: {}".format(e))
        return

    # Retrieve our IP (the address the camera should send the files to)
    local_ip_addr = get_local_ip_addr(if_name)
    print("Downloading files using local IP {}".format(local_ip_addr))

    # Download files from device
    downloaded_files = False
    port = 12346
    limit_count = 0
    for file in files:
        dest_path = os.path.join(out_folder, file)
        if not os.path.exists(dest_path):
            downloaded_files = True
            src_path = os.path.join(in_folder, file)

            if sync_limit and limit_count >= sync_limit:
                print("Sync limit met, waiting {} seconds".format(sync_cooldown))
                sleep(sync_cooldown)
                limit_count = 0

            print()
            print("================= {} ================".format(src_path))
            print("Downloading file...")
            success = download_file(tn, src_path, dest_path, local_ip_addr, port)
            port += 1
            limit_count += 1
            if not success:
                print("Download failed, removing file...")
                os.remove(dest_path)
                continue
            else:
                print("Download succeeded")

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
    success = False

    # nc -l -p [port] > [outfile]
    nc_proc = open_nc_port(port, dest_path)
    try:
        # nc -w 3 [host] [port] < [file]
        res = tn.run_command('nc -w 3 {} {} < {} || echo "Failure"'.format(local_ip_addr, port, src_path), result_timeout=10)
        print("DEBUG: Result of download operation: '%s'" % (res))
        success = not 'Failure' in res
    except Exception as e:
        success = False
        print("Failed to download %s: '%s'" % (src_path, e))

    # Kill process if it is still running
    if nc_proc.poll() is None:
        print("Killing leftover nc process...")
        nc_proc.terminate()

    return success


def open_nc_port(port, file):
    folder = os.path.dirname(file)
    if not os.path.exists(folder):
        os.makedirs(folder)

    outfile = open(file, 'w')
    p = sp.Popen(["nc", "-l", "-p {}".format(port)],shell=False,stdin=None,stdout=outfile,stderr=None,close_fds=False)
    return p


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
    parser.add_argument("--sync-limit", type=int, default=None, help="Number of files to sync at a time. If more are available, a cooldown will be invoked")
    parser.add_argument("--sync-cooldown", type=int, default=60, help="Cooldown (in seconds) if sync_limit have been met. Default 60")
    args = parser.parse_args()

    if args.interface not in ni.interfaces():
        print("Could not find given network interface '{}'.\n  Available interfaces are: {}".format(args.interface, ni.interfaces()))
        return

    do_sync(args.host, args.remote_folder, args.sync_folder, args.telnet_user, args.telnet_pass, args.interface, args.sync_limit, args.sync_cooldown)


if __name__ == "__main__":
    main()