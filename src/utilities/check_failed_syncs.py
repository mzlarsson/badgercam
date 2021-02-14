import os
import argparse
import sys

sys.path.append("../sync")

from convert import convert_to_mp4

def find_files(dir, validator):
    result = []
    for subdir, dirs, files in os.walk(dir):
        for filename in files:
            filepath = subdir + os.sep + filename

            size = os.path.getsize(filepath)
            if validator(filepath, size):
                result.append((filepath, size))
    return result

def delete_files(files):
    for file, size in files:
        os.remove(file)


def main():
    parser = argparse.ArgumentParser("Utility to clear out old failed syncs")
    subparsers = parser.add_subparsers(dest='subparser_name')
    
    parser_empty_files = subparsers.add_parser("emptyfile", help="Find empty files and delete them")
    parser_empty_files.add_argument("--delete", action="store_true", help="Deletes the found files")
    parser_empty_files.add_argument("folder", type=str, help="Folder to recursively look for empty files in")

    parser_missing_converted_files = subparsers.add_parser("noconvfile", help="Find files without converted mp4")
    parser_missing_converted_files.add_argument("--convert", action="store_true", help="Converts the found asf files")
    parser_missing_converted_files.add_argument("folder", type=str, help="Folder to recursively look for asf files in")

    args = parser.parse_args()

    if args.subparser_name == "emptyfile":
        files = find_files(args.folder, lambda path, size: (path.lower().endswith(".asf") and size == 0) or (path.lower().endswith(".mp4") and size == 159))
        for file, size in files:
            print("%s (%d bytes)" % (file, size))

        if args.delete:
            delete_files(files)
    elif args.subparser_name == "noconvfile":
        files = find_files(args.folder, lambda path, size: path.lower().endswith(".asf") and not os.path.exists(os.path.splitext(path)[0] + ".mp4"))
        for file, size in files:
            print("%s (%d bytes)" % (file, size))

        if args.convert:
            for file, size in files:
                convert_to_mp4(file)


if __name__ == "__main__":
    main()
