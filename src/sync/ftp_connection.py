import ftplib
import os

class FTPConnection:

    def __init__(self, host, user="root", password=""):
        self.client = None
        self.host = host
        self.user = user
        self.password = password

    def connect(self):
        self.client = ftplib.FTP(self.host)
        res = self.client.login(self.user, self.password)
        if res != "230 Operation successful":
            raise Exception(f"Failed to login to FTP client. Response: {res}")

    def list_files(self, folder, relative_folder=""):
        data = []
        self.client.dir(folder, data.append)
        result = []
        for line in data[1:]:
            filename = line.split()[-1]
            if line.startswith("d"):
                result.extend(self.list_files(os.path.join(folder, filename), os.path.join(relative_folder, filename)))
            else:
                result.append(os.path.join(relative_folder, filename))
        return result

    def download(self, src_path, dest_path):
        try:
            with open(dest_path, "wb") as out:
                res = self.client.retrbinary(f"RETR {src_path}", out.write)
                if res != "226 Operation successful":
                    raise Exception(res)
            return True
        except Exception as e:
            print(f"Failed to download file: {e}")
            return False

    def close(self):
        if self.client:
            self.client.quit()