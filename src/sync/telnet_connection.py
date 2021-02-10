import telnetlib
from time import sleep

class TelnetConnection:

    def __init__(self, host, user="root", password="", wait_after_login=None):
        self.host = host
        self.user = user
        self.password = password
        self.wait_after_login = wait_after_login

        self.needs_reconnect = False
        self.nof_reconnects = 0
        self.nof_max_reconnects = 5

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


    def run_command(self, cmd, result_timeout=3):
        if self.needs_reconnect:
            if self.nof_reconnects < self.nof_max_reconnects:
                print("Reconnecting...")
                self.nof_reconnects += 1
                self.connect()
                self.needs_reconnect = False
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



class ZosiTelnetConnection(TelnetConnection):

    def __init__(self, host):
        super().__init__(host)
        self.motd_header = "nfsroot: not found"