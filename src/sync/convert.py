
import subprocess
import os.path

def convert_to_mp4(infile, outfile=None, overwrite=False):
    if outfile is None:
        outfile = infile[:infile.rfind('.')] + '.mp4'

    if overwrite or not os.path.exists(outfile):
        subprocess.call(['vlc', '-I dummy', '-q', infile, '--sout=#transcode{vcodec=h264,scale=Auto,acodec=mpga,ab=128,channels=2,samplerate=44100,scodec=none}:standard{access=file,dst=%s}'%(outfile), 'vlc://quit'])
        return True
    else:
        print("Skipping conversion, file already exists")
        return False

if __name__ == "__main__":
    convert_to_mp4('synced_videos/20201223/0/205741.asf')
