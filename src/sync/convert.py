
import subprocess
import os
import os.path

def convert_to_mp4(infile, outfile=None, overwrite=False):
    if outfile is None:
        outfile = infile[:infile.rfind('.')] + '.mp4'

    outdir = os.path.dirname(outfile)
    if not os.path.exists(outdir):
        try:
            os.makedirs(outdir)
        except:
            print("Failed to create folder to put output file in")
            return False

    if not outfile.endswith(".mp4"):
        print("Destination file must have .mp4 extension")
        return False
    elif overwrite or not os.path.exists(outfile):
        subprocess.call(['vlc', '-I dummy', '-q', infile, '--sout=#transcode{vcodec=h264,scale=Auto,acodec=mpga,ab=128,channels=2,samplerate=44100,scodec=none}:standard{access=file,dst=%s}'%(outfile), 'vlc://quit'])
        return True
    else:
        print("Skipping conversion, file already exists")
        return False

if __name__ == "__main__":
    import sys
    if len(sys.argv) == 2:
        print("Running conversion with input file as only argument")
        convert_to_mp4(sys.argv[1])
    elif len(sys.argv) == 3:
        print("Running conversion with input and output file")
        convert_to_mp4(sys.argv[1], sys.argv[2])
    else:
        print("Running conversion with hardcoded input file")
        convert_to_mp4('synced_videos/20201223/0/205741.asf')
