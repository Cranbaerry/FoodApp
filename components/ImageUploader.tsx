"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Drag-and-drop / click-to-pick uploader for a single food photo.
 * Shows a local preview immediately, then hands the file to the parent.
 */
export function ImageUploader({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file && file.type.startsWith("image/")) onFile(file);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
        dragging ? "border-brand-500 bg-brand-50" : "border-gray-300 bg-white hover:border-brand-400"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="mb-3 text-5xl">🍽️</div>
      <p className="text-lg font-semibold text-gray-800">Drop a photo of your food</p>
      <p className="mt-1 text-sm text-gray-500">or click to take / choose a picture</p>
    </div>
  );
}
