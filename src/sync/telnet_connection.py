import telnetlib
from time import sleep
import os
import netifaces
import subprocess as sp

class TelnetClient:

    def __init__(self, host, user="root", password="", wait_after_login=None):
        self.host = host
        self.user = user
        self.password = password
        self.wait_after_login = wait_after_login

        self.needs_reconnect = False
        self.nof_reconnects = 0
        self.nof_max_reconnects = 5
        self.current_dir = "~"

        self.skip_to_post_motd = True
        self.login_prompt_text = "login: "
        self.password_prompt_text = "Password: "
        self.motd_header = "Last login"
        self.terminal_char = "$"
        self.encoding = 'ascii'


    def _login(self):
        self.read_until(self.login_prompt_text)
        self.write("{}\n".format(self.user))
        self.read_until(self.password_prompt_text)
        self.write("{}\n".format(self.password))

        if self.user == "root":
            print("User root detected. Setting terminal char to '#'")
            self.terminal_char = "#"

        if self.skip_to_post_motd:
            self.read_until(self.motd_header, 3)
            self.read_until("\n", 0.5)

        if self.wait_after_login:
            sleep(self.wait_after_login)


    def connect(self):
        self.tn = telnetlib.Telnet(self.host)
        self._login()


    def move_to_dir(self, dir):
        if dir.startswith("/"):
            # absolute path
            self.current_dir = dir
        else:
            # relative path
            self.current_dir = "%s/%s" % (self.current_dir, dir)
        print("Setting current directory %s" % (self.current_dir))
        
        self.run_command("cd {}".format(dir))


    def run_command(self, cmd, result_timeout=3):
        if self.needs_reconnect:
            if self.nof_reconnects < self.nof_max_reconnects:
                print("Reconnecting...")
                self.needs_reconnect = False
                self.nof_reconnects += 1
                self.connect()
                self.move_to_dir(self.current_dir)
            else:
                raise Exception("Too many failed reconnects")


        try:
            # print("Running '{}'".format(cmd))
            self.write("{}\n".format(cmd))                                            # Write command
            self.read_until("{}".format(cmd[-30:]), 3)                                # Skip header (but might be truncated)
            self.read_until("\n", 3)
            result = self.read_until(self.terminal_char + " ", result_timeout)        # Read to next command prompt
            start_of_last_line = result.rfind('\n')
            if start_of_last_line >= 0:                                               # Strip last line (new cmd prompt)
                result = result[:start_of_last_line]
            return result
        except Exception as e:
            # Record failure, then keep going
            self.needs_reconnect = True
            raise e


    def write(self, data):
        self.tn.write(self._to_bytes(data))


    def read_until(self, data, timeout=None):
        return self._from_bytes(self.tn.read_until(self._to_bytes(data), timeout))


    def read_all(self):
        return self._from_bytes(self.tn.read_all())


    def close(self):
        self.tn.close()
        self.tn = None


    def _to_bytes(self, data):
        return data.encode(self.encoding)


    def _from_bytes(self, data):
        return data.decode(self.encoding)



class ZosiTelnetClient(TelnetClient):

    def __init__(self, host):
        super().__init__(host)
        self.motd_header = "nfsroot: not found"


class TelnetConnection:

    def __init__(self, if_name, host, user, password, wait_after_login=2):
        self.client = TelnetClient(host, user, password, wait_after_login)
        self.local_ip = netifaces.ifaddresses(if_name)[netifaces.AF_INET][0]['addr']
        self.download_port = 12346

    def connect(self):
        self.client.connect()

    def list_files(self, folder):
        self.client.move_to_dir(folder)
        return self._get_files_in_folder(folder)

    def _get_files_in_folder(self, folder):
        lines = self.client.run_command("ls -al --color=none {}".format(folder)).split("\n")

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
                result += self._get_files_in_folder(path)
            else:
                result.append(path)
        return result

    def download(self, src_path, dest_path):
        success = False

        # nc -l -p [port] > [outfile]
        nc_proc = self._open_nc_port(self.download_port, dest_path)
        try:
            # nc -w 3 [host] [port] < [file]
            res = self.client.run_command('nc -w 3 {} {} < {} || echo "Failure"'.format(self.local_ip, self.download_port, src_path), result_timeout=10)
            print("DEBUG: Result of download operation: '%s'" % (res))
            success = not 'Failure' in res
        except Exception as e:
            success = False
            print("Failed to download %s: '%s'" % (src_path, e))

        # Kill process if it is still running
        if nc_proc.poll() is None:
            print("Killing leftover nc process...")
            nc_proc.terminate()

        self.download_port += 1
        return success

    def _open_nc_port(port, file):
        outfile = open(file, 'w')
        p = sp.Popen(["nc", "-l", "-p {}".format(port)],shell=False,stdin=None,stdout=outfile,stderr=None,close_fds=False)
        return p

    def close(self):
        self.client.write("exit")