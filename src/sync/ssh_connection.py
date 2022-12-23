import pysftp
import stat
import os

class SSHConnection:

    def __init__(self, host, user="root", password=""):
        self.client = None
        self.host = host.split(":")[0]
        self.port = (int(host.split(":")[1]) if ":" in host else 22)
        self.user = user
        self.password = password

    def connect(self):
        self.client = pysftp.Connection(host=self.host, port=self.port, username=self.user, password=self.password)

    def list_files(self, folder, relative_folder=""):
        files = self.client.listdir_attr(folder)
        result = []
        for file in files:
            if stat.S_ISDIR(file.st_mode):
                result.extend(self.list_files(os.path.join(folder, file.filename), os.path.join(relative_folder, file.filename)))
            else:
                result.append(os.path.join(relative_folder, file.filename))
        return result

    def download(self, src_path, dest_path):
        try:
            self.client.get(src_path, dest_path)
            return True
        except Exception as e:
            print(f"Failed to download file: {e}")
            return False

    def close(self):
        if self.client:
            self.client.close()