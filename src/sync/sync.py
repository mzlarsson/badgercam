from telnet_connection import TelnetConnection
from ssh_connection import SSHConnection
from convert import convert_to_mp4

import os
import netifaces as ni
import argparse
from time import sleep
import json

class Download:

    def __init__(self, filename, full_path):
        self.filename = filename
        self.full_path = full_path
        self.success = False
        self.converted = False

    def set_fullpath(self, path):
        self.full_path = path

    def set_success(self, success=True):
        self.success = success

    def set_converted(self, converted=True):
        self.converted = converted

    def to_json(self):
        data = {
            "filename": self.filename,
            "full_path": self.full_path,
            "success": self.success,
            "converted": self.converted
        }
        return json.dumps(data)
    


def do_sync(proto, host, in_folder, out_folder, user="root", password="", if_name="wlan0", sync_limit=None, sync_cooldown=60):
    # Authentication
    print("Connecting to {}".format(host))
    try:
        device = get_device(proto, if_name, host, user, password, wait_after_login=2)
        device.connect()
        print("Connected to host (no guarantee for successful auth)\n")
    except Exception as e:
        print("Failed to connect: {}".format(e))
        return

    # Fetch list of files
    try:
        files = device.list_files(in_folder)
        print("Found {} files on camera memory card".format(len(files)))
    except Exception as e:
        print("Failed to list files on device: {}".format(e))
        return

    print("Downloading files...")

    # Download files from device
    downloaded_files = []
    limit_count = 0
    for file in files:
        dest_path = os.path.join(out_folder, file)
        if not os.path.exists(dest_path):
            src_path = os.path.join(in_folder, file)

            if sync_limit and limit_count >= sync_limit:
                print("Sync limit met, waiting {} seconds".format(sync_cooldown))
                sleep(sync_cooldown)
                limit_count = 0

            print()
            print("================= {} ================".format(src_path))
            print("Downloading file...")
            # Make sure folder exists
            dest_folder = os.path.dirname(dest_path)
            if not os.path.exists(dest_folder):
                os.makedirs(dest_folder)

            download = Download(file, dest_path)
            success = device.download(src_path, dest_path)
            limit_count += 1

            download.set_success(success)
            if success:
                print("Download succeeded")
            else:
                print("Download failed, removing file...")
                os.remove(dest_path)

            downloaded_files.append(download)

    if not downloaded_files:
        print("No new files to download")

    # Close connection
    device.close()

    return downloaded_files

def get_device(proto, if_name, host, user, password, wait_after_login=2):
    if proto == "ssh":
        return SSHConnection(host, user, password)
    elif proto == "telnet":
        return TelnetConnection(if_name, host, user, password, wait_after_login)
    else:
        raise Exception(f"Invalid protocol: {proto}")


def do_convert_if_needed(converted_out_folder, download):
    if download.filename.lower().endswith(".asf"):
        out_file = os.path.join(converted_out_folder, download.filename)
        out_file = out_file[:out_file.rfind(".")] + ".mp4"  # Fix extension

        print("Converting asf file to mp4...")
        print("\tsource=%s" % download.full_path)
        print("\tdest=%s" % out_file)
        if convert_to_mp4(infile=download.full_path, outfile=out_file, overwrite=False):
            download.set_converted(True)
            download.set_fullpath(out_file)
        else:
            print("WARNING: Failed to convert file")


def main():
    parser = argparse.ArgumentParser(description="Sync video files (.ASF) via telnet/SSH and convert to readable mp4.")
    parser.add_argument("host", type=str, help="Host to connect to, either as IP (preferred) or hostname.")
    parser.add_argument("--proto", type=str, choices=["telnet","ssh"], default="telnet", help="Protocol to download files with")
    parser.add_argument("--remote-folder", type=str, default="/mnt/mmc1", help="Remote folder where the videos are located, e.g. /mnt/mmc1")
    parser.add_argument("--sync-raw-folder", type=str, default="web/public/synced_videos_raw", help="Local folder where unconverted videos are synced, e.g. web/public/synced_videos_raw")
    parser.add_argument("--sync-conv-folder", type=str, default="web/public/synced_videos", help="Local folder where mp4 videos are stored, e.g. web/public/synced_videos")
    parser.add_argument("--username", type=str, default="root", help="Username to supply to Telnet/SSH session")
    parser.add_argument("--password", type=str, default="", help="Password to supply to Telnet/SSH session")
    parser.add_argument("--interface", type=str, default="wlan0", help="Interface used for network communication with camera (used to retrieve current IP address)")
    parser.add_argument("--sync-limit", type=int, default=None, help="Number of files to sync at a time. If more are available, a cooldown will be invoked")
    parser.add_argument("--sync-cooldown", type=int, default=60, help="Cooldown (in seconds) if sync_limit have been met. Default 60")
    parser.add_argument("--summary", type=str, help="Path to where to put summary of downloads (JSON format). Default None")
    args = parser.parse_args()

    if args.proto == "telnet" and args.interface not in ni.interfaces():
        print("Could not find given network interface '{}'.\n  Available interfaces are: {}".format(args.interface, ni.interfaces()))
        return

    downloads = do_sync(args.proto, args.host, args.remote_folder, args.sync_raw_folder, args.username, args.password, args.interface, args.sync_limit, args.sync_cooldown)

    for download in downloads:
        do_convert_if_needed(args.sync_conv_folder, download)

    if args.summary:
        # When we move the sync code to NodeJS as well this ugliness will go away :D
        output = "{\"host\": \"%s\", \"downloads\": [%s]}" % (args.host, ", ".join([d.to_json() for d in downloads]))
        with open(args.summary, "w") as out:
            out.write(output)



if __name__ == "__main__":
    main()