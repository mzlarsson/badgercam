import telnetlib
from time import sleep

class TelnetConnection:

    def __init__(self, host):
        self.tn = telnetlib.Telnet(host)
        self.login_prompt_text = "login: "
        self.password_prompt_text = "Password: "
        self.motd_header = "Last login"
        self.terminal_char = "$"
        self.encoding = 'ascii'


    def login(self, user="root", password="", skip_to_post_motd=True, wait_after_login=None):
        self.read_until(self.login_prompt_text)
        self.write("{}\n".format(user))
        self.read_until(self.password_prompt_text)
        self.write("{}\n".format(password))

        if user == "root":
            print("User root detected. Setting terminal char to '#'")
            self.terminal_char = "#"

        if skip_to_post_motd:
            self.read_until(self.motd_header, 3)
            self.read_until("\n", 0.5)

        if wait_after_login:
            sleep(wait_after_login)


    def run_command(self, cmd, result_timeout=3):
        # print("Running '{}'".format(cmd))
        self.write("{}\n".format(cmd))                                            # Write command
        self.read_until("{}".format(cmd[-30:]), 3)                                # Skip header (but might be truncated)
        self.read_until("\n", 3)
        result = self.read_until(self.terminal_char + " ", result_timeout)        # Read to next command prompt
        start_of_last_line = result.rfind('\n')
        if start_of_last_line >= 0:                                               # Strip last line (new cmd prompt)
            result = result[:start_of_last_line]
        return result


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