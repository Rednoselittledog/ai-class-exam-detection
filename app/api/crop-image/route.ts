import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { success: false, error: "No image provided" },
        { status: 400 }
      );
    }

    // Path to Python script (using OMRChecker contour approach)
    const scriptPath = path.join(
      process.cwd(),
      "lib",
      "python",
      "crop_page.py"
    );

    console.log("[DEBUG] Using OMRChecker contour-based detection");

    // Call Python script
    const result = await runPythonScript(scriptPath, image);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in crop-image API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Execute Python script and return result
 */
function runPythonScript(
  scriptPath: string,
  imageData: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    const python = spawn("python", [scriptPath, imageData]);

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("close", (code) => {
      // Log stderr for debugging
      if (stderr) {
        console.log("Python stderr output:");
        console.log(stderr);
      }

      if (code !== 0) {
        reject(new Error(`Python script failed: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });

    python.on("error", (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}
