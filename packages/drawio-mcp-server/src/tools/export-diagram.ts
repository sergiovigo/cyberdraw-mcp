import { existsSync, lstatSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";

import { z } from "zod";

import { export_tool_handler } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_export_diagram = "export-diagram";

export function validateOutputPath(outputPath: string): void {
  if (!isAbsolute(outputPath)) {
    throw new Error("output_path must be an absolute path");
  }

  const parentDir = dirname(outputPath);
  if (!existsSync(parentDir)) {
    throw new Error(
      `output_path parent directory does not exist: ${parentDir}`,
    );
  }

  if (!statSync(parentDir).isDirectory()) {
    throw new Error(`output_path parent is not a directory: ${parentDir}`);
  }

  try {
    const destinationStats = lstatSync(outputPath);
    if (destinationStats.isSymbolicLink()) {
      throw new Error(`output_path must not be a symbolic link: ${outputPath}`);
    }
    if (destinationStats.isDirectory()) {
      throw new Error(`output_path must not be a directory: ${outputPath}`);
    }
    if (!destinationStats.isFile()) {
      throw new Error(
        `output_path must be a regular file when it already exists: ${outputPath}`,
      );
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return;
    }
    throw error;
  }
}

export function writeExportOutputFile(
  outputPath: string,
  content: string | Buffer,
): void {
  validateOutputPath(outputPath);
  if (Buffer.isBuffer(content)) {
    writeFileSync(outputPath, content);
  } else {
    writeFileSync(outputPath, content, "utf-8");
  }
}

export const registerExportDiagramTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_export_diagram,
    "Export the target page or current diagram as SVG, PNG, or XML. Returns the diagram data as base64 (PNG) or text (SVG/XML). Optionally saves to a file.",
    {
      target_page: target_page_field(),
      format: z
        .enum(["svg", "png", "xml"])
        .describe(
          "Export format: svg for vector graphics, png for raster image, xml for raw diagram data",
        ),
      scale: z
        .number()
        .optional()
        .default(1)
        .describe("Zoom factor for the export (1 = 100%)"),
      border: z
        .number()
        .optional()
        .default(0)
        .describe("Border width in pixels around the diagram"),
      background: z
        .string()
        .optional()
        .default("#ffffff")
        .describe("Background color in hex format (e.g., #ffffff)"),
      shadow: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include shadow effects in the export"),
      crop: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "Crop the export to diagram bounds (true) or full page (false)",
        ),
      selection_only: z
        .boolean()
        .optional()
        .default(false)
        .describe("Export only the currently selected cells"),
      transparent: z
        .boolean()
        .optional()
        .default(false)
        .describe("Use transparent background (overrides background color)"),
      dpi: z
        .number()
        .optional()
        .default(96)
        .describe("DPI for PNG export (affects quality)"),
      embed_xml: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Embed the diagram XML data in SVG/PNG so it can be reopened in draw.io",
        ),
      size: z
        .enum(["selection", "page", "diagram"])
        .optional()
        .default("diagram")
        .describe(
          "What to export: 'selection' for selected cells only, 'page' for the target page, 'diagram' for the entire model",
        ),
      output_path: z
        .string()
        .optional()
        .describe(
          "Absolute file path to save the exported file (must be an absolute path)",
        ),
    },
    async (args, _extra) => {
      const exportHandler = export_tool_handler(TOOL_export_diagram, context, {
        queue: true,
      });
      const result = await exportHandler(args, _extra);

      if (args.output_path) {
        const exportContent = result.content;
        if (args.format === "png") {
          const imageContent = exportContent.find(
            (c: any) => c.type === "image",
          ) as any;
          if (imageContent) {
            writeExportOutputFile(
              args.output_path,
              Buffer.from(imageContent.data, "base64"),
            );
          }
        } else {
          const textContent = exportContent.find(
            (c: any) => c.type === "text",
          ) as any;
          if (textContent) {
            writeExportOutputFile(args.output_path, textContent.text);
          }
        }

        result.content.push({
          type: "text" as const,
          text: `Saved to: ${args.output_path}`,
        });
      }

      return result;
    },
  );
};
