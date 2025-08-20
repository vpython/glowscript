import argparse
import os
import subprocess

def convert_file(input_path, output_path):
    """Converts a single Python file to an HTML snippet."""
    try:
        converter_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'convert.js')
        result = subprocess.run(
            ['node', converter_path, input_path],
            capture_output=True,
            text=True,
            check=True
        )
        with open(output_path, 'w') as f:
            f.write(result.stdout)
        print(f"Successfully converted {input_path} to {output_path}")
    except subprocess.CalledProcessError as e:
        print(f"Error converting {input_path}: {e.stderr}")
    except Exception as e:
        print(f"An error occurred: {e}")

def main():
    parser = argparse.ArgumentParser(description="Convert Python files to HTML snippets.")
    parser.add_argument("input_dir", help="The input directory containing Python files.")
    parser.add_argument("output_dir", help="The output directory for the HTML files.")
    args = parser.parse_args()

    if not os.path.isdir(args.input_dir):
        print(f"Error: Input directory not found at {args.input_dir}")
        return

    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)

    for filename in os.listdir(args.input_dir):
        if filename.endswith(".py"):
            input_path = os.path.join(args.input_dir, filename)
            output_filename = os.path.splitext(filename)[0] + ".html"
            output_path = os.path.join(args.output_dir, output_filename)
            convert_file(input_path, output_path)

if __name__ == "__main__":
    main()
