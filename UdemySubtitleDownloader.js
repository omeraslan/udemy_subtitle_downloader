// ==UserScript==
// @name         Udemy Subtitle Downloader
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-capture and download subtitle files from Udemy courses
// @author       oaslan
// @license      MIT
// @match        https://www.udemy.com/course/*/learn/lecture/*
// @icon         https://www.udemy.com/staticx/udemy/images/v8/favicon-32x32.png
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  const VERSION = "1.0";

  // Track current section for subtitle capture
  let currentSectionName = "";

  // Track skipped/timeout videos for report
  let skippedVideos = [];

  // Check if URL is an actual subtitle file (not thumbnail sprites)
  function isActualSubtitle(url) {
    if (url.includes("thumb-sprites.vtt")) {
      return false;
    }
    if (url.includes("vtt-c.udemycdn.com")) {
      return true;
    }
    return false;
  }

  // Clean VTT content
  function cleanVTTContent(vttText) {
    const lines = vttText.split("\n");
    const result = [];
    let i = 0;

    if (lines[0]?.startsWith("WEBVTT")) {
      result.push(lines[0]);
      i = 1;
    }

    while (i < lines.length) {
      const line = lines[i];

      if (line.includes("-->")) {
        const timestampLine = line;
        i++;

        const textLines = [];
        while (i < lines.length && lines[i].trim() !== "") {
          const textLine = lines[i].trim();
          if (
            !textLine.includes("thumb-sprites.jpg") &&
            !textLine.includes("#xywh=")
          ) {
            textLines.push(textLine);
          }
          i++;
        }

        if (textLines.length > 0) {
          result.push("");
          result.push(timestampLine);
          result.push(...textLines);
        }
      } else {
        i++;
      }
    }

    return result.join("\n");
  }

  // Function to get lecture title
  function getLectureTitle() {
    const activeItem = document.querySelector(
      'li[aria-current="true"] [data-purpose="item-title"]',
    );
    if (activeItem?.textContent?.trim()) {
      return activeItem.textContent.trim();
    }

    const currentItem = document.querySelector(
      '[class*="is-current"] [data-purpose="item-title"]',
    );
    if (currentItem?.textContent?.trim()) {
      return currentItem.textContent.trim();
    }

    const lectureIdMatch = window.location.pathname.match(/lecture\/(\d+)/);
    if (lectureIdMatch) {
      const lectureId = lectureIdMatch[1];
      const itemWithId = document.querySelector(
        `[data-purpose*="curriculum-item"][data-purpose*="${lectureId}"]`,
      );
      if (itemWithId) {
        const title = itemWithId.querySelector('[data-purpose="item-title"]');
        if (title?.textContent?.trim()) {
          return title.textContent.trim();
        }
      }
    }

    if (lectureIdMatch) {
      return `Lecture_${lectureIdMatch[1]}`;
    }

    return "Unknown_Lecture";
  }

  // Monitor Performance API for .vtt files
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (entry.name.includes(".vtt")) {
        if (!isActualSubtitle(entry.name)) {
          return;
        }

        setTimeout(() => {
          const lectureTitle = getLectureTitle();

          const saved = JSON.parse(
            localStorage.getItem("udemy_subtitles") || "[]",
          );
          const urlWithoutParams = entry.name.split("?")[0];

          if (!saved.some((s) => s.url.split("?")[0] === urlWithoutParams)) {
            saved.push({
              title: lectureTitle,
              url: entry.name,
              section: currentSectionName || "Unknown Section",
              captured_at: new Date().toISOString(),
            });
            localStorage.setItem("udemy_subtitles", JSON.stringify(saved));
            updateButtonCount();
          }
        }, 1500);
      }
    });
  });

  observer.observe({ entryTypes: ["resource"] });

  // Load JSZip
  function loadJSZip() {
    return new Promise((resolve, reject) => {
      if (window.JSZip) {
        resolve(window.JSZip);
        return;
      }
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = () => resolve(window.JSZip);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Update button count
  function updateButtonCount() {
    const saved = JSON.parse(localStorage.getItem("udemy_subtitles") || "[]");
    const countElement = document.getElementById("subtitle-count");
    if (countElement) {
      countElement.textContent = saved.length;
    }
  }

  // Normalize section name to English
  function normalizeSectionName(name) {
    return name
      .replace(/^Bölüm\s*/i, "Section ") // Turkish
      .replace(/^Sección\s*/i, "Section ") // Spanish
      .replace(/^Seção\s*/i, "Section ") // Portuguese
      .replace(/^Abschnitt\s*/i, "Section ") // German
      .replace(/^セクション\s*/i, "Section ") // Japanese
      .replace(/^섹션\s*/i, "Section ") // Korean
      .replace(/^Раздел\s*/i, "Section ") // Russian
      .replace(/^Section\s*/i, "Section ") // Already English (normalize spacing)
      .trim();
  }

  // Create safe folder/file name
  function safeName(name) {
    return name
      .replace(/[^a-z0-9\s\-\_\.]/gi, "")
      .replace(/\s+/g, "_")
      .substring(0, 100);
  }

  // Update progress bar
  function updateProgressBar(current, total, statusText) {
    const statusEl = document.getElementById("auto-capture-status");
    if (!statusEl) return;

    const percentage = Math.round((current / total) * 100);
    statusEl.innerHTML = `
      <div style="width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 11px; color: rgba(255,255,255,0.7); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${statusText}</span>
          <span style="font-size: 11px; color: rgba(255,255,255,0.5); font-weight: 500;">${percentage}%</span>
        </div>
        <div style="background: rgba(255,255,255,0.1); border-radius: 6px; height: 6px; overflow: hidden;">
          <div style="
            background: linear-gradient(90deg, #14b8a6 0%, #06b6d4 100%);
            height: 100%;
            width: ${percentage}%;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 6px;
          "></div>
        </div>
        <div style="margin-top: 6px; font-size: 10px; color: rgba(255,255,255,0.35); text-align: center;">${current} of ${total} files</div>
      </div>
    `;
  }

  // Reset status to text mode
  function resetStatusDisplay(message) {
    const statusEl = document.getElementById("auto-capture-status");
    if (!statusEl) return;

    const isSuccess = message.includes("✅") || message.includes("Downloaded");
    const isError =
      message.includes("❌") ||
      message.includes("⚠️") ||
      message.includes("Error");

    let dotColor = "#14b8a6";
    if (isError) dotColor = "#f43f5e";

    statusEl.innerHTML = `
      <span style="
        width: 6px;
        height: 6px;
        background: ${dotColor};
        border-radius: 50%;
        margin-right: 10px;
        flex-shrink: 0;
      "></span>
      <span style="color: rgba(255,255,255,${isSuccess ? "0.8" : "0.5"});">${message.replace(/[✅❌⚠️]/g, "").trim()}</span>
    `;
  }

  // Generate report content
  function generateReport(skipped, failed403, capturedFiles, totalSections) {
    const courseMatch = window.location.pathname.match(/course\/([^\/]+)/);
    const courseName = courseMatch ? courseMatch[1] : "Unknown Course";
    const now = new Date().toISOString();

    // Verify skipped list - remove any that were actually captured
    const verifiedSkipped = skipped.filter((skippedItem) => {
      const skippedTitleClean = skippedItem.title
        .replace(/^\d+\.\s*/, "")
        .toLowerCase();
      return !capturedFiles.some((captured) => {
        const capturedTitleClean = captured.title
          .replace(/^\d+\.\s*/, "")
          .toLowerCase();
        return (
          capturedTitleClean.includes(skippedTitleClean) ||
          skippedTitleClean.includes(capturedTitleClean)
        );
      });
    });

    let report = `UDEMY SUBTITLE DOWNLOAD REPORT
==============================
Course: ${courseName}
Generated: ${now}
Total Sections: ${totalSections}
Total Captured: ${capturedFiles.length}
Total Skipped (Timeout): ${verifiedSkipped.length}
Total Failed (403): ${failed403.length}

`;

    // List captured files
    if (capturedFiles.length > 0) {
      report += `\nCAPTURED FILES:\n`;
      report += `${"─".repeat(50)}\n`;
      capturedFiles.forEach((item, idx) => {
        const section = normalizeSectionName(item.section || "Unknown");
        report += `${idx + 1}. [${section}] ${item.title}\n`;
      });
    }

    if (verifiedSkipped.length > 0) {
      report += `\nSKIPPED VIDEOS (Timeout - No subtitle detected):\n`;
      report += `${"─".repeat(50)}\n`;
      verifiedSkipped.forEach((item, idx) => {
        const section = normalizeSectionName(item.section || "Unknown");
        report += `${idx + 1}. [${section}] ${item.title}\n`;
      });
    }

    if (failed403.length > 0) {
      report += `\nFAILED VIDEOS (403 Forbidden):\n`;
      report += `${"─".repeat(50)}\n`;
      failed403.forEach((item, idx) => {
        const section = normalizeSectionName(item.section || "Unknown");
        report += `${idx + 1}. [${section}] ${item.title}\n`;
      });
    }

    if (verifiedSkipped.length === 0 && failed403.length === 0) {
      report += `\nAll videos were successfully captured! No issues detected.\n`;
    }

    return report;
  }

  // Download all as ZIP with progress bar and folders
  async function downloadAllAsZip() {
    const saved = JSON.parse(localStorage.getItem("udemy_subtitles") || "[]");

    if (saved.length === 0) {
      alert("❌ No subtitles collected. Navigate through lectures first!");
      return;
    }

    updateProgressBar(0, saved.length, "Loading JSZip...");

    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();

      const failed403 = [];
      const capturedFiles = []; // Track successfully captured files with title and section

      // Group by section
      const sections = new Set(saved.map((s) => s.section));

      for (let i = 0; i < saved.length; i++) {
        const item = saved[i];
        updateProgressBar(
          i + 1,
          saved.length,
          `Downloading: ${item.title.substring(0, 30)}...`,
        );

        try {
          const response = await fetch(item.url);

          // Check for 403 error
          if (response.status === 403) {
            console.error(`  ❌ 403 Forbidden: ${item.title}`);
            failed403.push({
              title: item.title,
              section: item.section,
              url: item.url,
            });

            // Show warning and stop
            resetStatusDisplay("⚠️ 403 Error - Session expired");
            const shouldContinue = confirm(
              `⚠️ 403 Forbidden Error!\n\nThe download URL for "${item.title}" has expired.\n\nThis usually means your Udemy session has expired or the URLs are no longer valid.\n\nRecommendation:\n1. Clear the queue\n2. Refresh the page\n3. Start auto-capture again\n\nClick OK to continue downloading remaining files, or Cancel to stop.`,
            );

            if (!shouldContinue) {
              break;
            }
            continue;
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const vttContent = await response.text();
          const cleanedContent = cleanVTTContent(vttContent);

          // Create folder structure: Section/Video.vtt
          // Normalize section name first, then make it safe for filesystem
          const normalizedSection = normalizeSectionName(
            item.section || "Unknown_Section",
          );
          const sectionFolder = safeName(normalizedSection);
          const fileName = safeName(item.title);

          zip.file(`${sectionFolder}/${fileName}.vtt`, cleanedContent);
          capturedFiles.push({
            title: item.title,
            section: item.section,
            fileName: `${sectionFolder}/${fileName}.vtt`,
          });

          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`  ❌ Failed:`, error);
          failed403.push({
            title: item.title,
            section: item.section,
            error: error.message,
          });
        }
      }

      // Add report.txt
      updateProgressBar(saved.length, saved.length, "Generating report...");
      const reportContent = generateReport(
        skippedVideos,
        failed403,
        capturedFiles,
        sections.size,
      );
      zip.file("report.txt", reportContent);

      updateProgressBar(saved.length, saved.length, "Creating ZIP file...");

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const courseMatch = window.location.pathname.match(/course\/([^\/]+)/);
      const courseName = courseMatch ? courseMatch[1] : "udemy_course";

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${courseName}_subtitles.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      resetStatusDisplay(`✅ Downloaded ${capturedFiles.length} files!`);

      if (failed403.length > 0) {
        alert(
          `⚠️ Download completed with issues!\n\nSuccessful: ${capturedFiles.length}\nFailed (403): ${failed403.length}\n\nCheck report.txt in the ZIP for details.`,
        );
      } else {
        alert(`✅ Downloaded ${capturedFiles.length} subtitle files!`);
      }
    } catch (error) {
      console.error("❌ Error:", error);
      resetStatusDisplay("❌ Download failed");
      alert("❌ Error: " + error.message);
    }
  }

  // Clear
  function clearSubtitles() {
    localStorage.removeItem("udemy_subtitles");
    skippedVideos = [];
    updateButtonCount();
    resetStatusDisplay("Ready to capture");
  }

  // ============================================
  // AUTO-CAPTURE FUNCTIONALITY
  // ============================================

  let isAutoCaptureRunning = false;
  let shouldStopAutoCapture = false;

  // Get all section panels
  function getAllSections() {
    return document.querySelectorAll('[data-purpose^="section-panel-"]');
  }

  // Expand a section and wait for content to load
  async function expandSection(section) {
    const toggleBtn = section.querySelector(".js-panel-toggler");
    const isExpanded = toggleBtn?.getAttribute("aria-expanded") === "true";

    if (!isExpanded && toggleBtn) {
      toggleBtn.click();

      const maxWait = 5000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait) {
        await sleep(300);
        const items = section.querySelectorAll(
          '[data-purpose^="curriculum-item-"]',
        );
        if (items.length > 0) {
          break;
        }
      }
    }
  }

  // Get all video lectures from a section
  function getVideoLecturesFromSection(section) {
    const items = section.querySelectorAll(
      '[data-purpose^="curriculum-item-"]',
    );
    const videoLectures = [];

    items.forEach((item) => {
      const parentLi = item.closest("li");
      if (!parentLi) return;

      const allUseElements = parentLi.querySelectorAll("use");
      let isVideo = false;
      allUseElements.forEach((use) => {
        const href = use.getAttribute("xlink:href");
        if (href && href.includes("icon-video")) {
          isVideo = true;
        }
      });

      if (isVideo) {
        const titleEl = parentLi.querySelector('[data-purpose="item-title"]');
        if (titleEl) {
          videoLectures.push({
            element: item,
            title: titleEl.textContent.trim(),
          });
        }
      }
    });

    return videoLectures;
  }

  // Sleep helper
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Wait for subtitle capture with timeout
  function waitForSubtitleCapture(maxWaitMs = 30000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const initialCount = JSON.parse(
        localStorage.getItem("udemy_subtitles") || "[]",
      ).length;

      const checkInterval = setInterval(() => {
        const currentCount = JSON.parse(
          localStorage.getItem("udemy_subtitles") || "[]",
        ).length;

        if (currentCount > initialCount) {
          clearInterval(checkInterval);
          resolve({ success: true, reason: "captured" });
          return;
        }

        if (Date.now() - startTime >= maxWaitMs) {
          clearInterval(checkInterval);
          resolve({ success: false, reason: "timeout" });
          return;
        }

        if (shouldStopAutoCapture) {
          clearInterval(checkInterval);
          resolve({ success: false, reason: "stopped" });
          return;
        }
      }, 500);
    });
  }

  // Update auto-capture status display
  function updateAutoCaptureStatus(message) {
    const statusEl = document.getElementById("auto-capture-status");
    if (statusEl) {
      const isCapturing = isAutoCaptureRunning;
      statusEl.innerHTML = `
        <span style="
          width: 6px;
          height: 6px;
          background: ${isCapturing ? "#f59e0b" : "#14b8a6"};
          border-radius: 50%;
          margin-right: 10px;
          flex-shrink: 0;
          ${isCapturing ? "animation: usd-pulse 1s infinite;" : ""}
        "></span>
        <span style="color: rgba(255,255,255,0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${message}</span>
      `;
    }
  }

  // Find and click the first video in the course
  async function clickFirstVideo() {
    const sections = getAllSections();
    if (sections.length === 0) return false;

    // Expand first section
    const firstSection = sections[0];
    await expandSection(firstSection);
    await sleep(500);

    // Get videos from first section
    const lectures = getVideoLecturesFromSection(firstSection);
    if (lectures.length > 0) {
      lectures[0].element.click();
      await sleep(2000);
      return true;
    }

    return false;
  }

  // Main auto-capture function
  async function startAutoCapture() {
    if (isAutoCaptureRunning) {
      return;
    }

    isAutoCaptureRunning = true;
    shouldStopAutoCapture = false;
    skippedVideos = []; // Reset skipped videos
    updateAutoCaptureButtonState();

    const sections = getAllSections();
    let totalProcessed = 0;
    let totalCaptured = 0;
    let totalSkipped = 0;
    let totalTimeout = 0;

    // Click first video to initialize
    updateAutoCaptureStatus("Finding first video...");
    await clickFirstVideo();

    for (let sectionIdx = 0; sectionIdx < sections.length; sectionIdx++) {
      if (shouldStopAutoCapture) break;

      const section = sections[sectionIdx];
      const rawSectionTitle =
        section
          .querySelector(".ud-accordion-panel-title")
          ?.textContent?.trim() || `Section ${sectionIdx + 1}`;

      // Normalize to English and update current section
      const sectionTitle = normalizeSectionName(rawSectionTitle);
      currentSectionName = sectionTitle;

      updateAutoCaptureStatus(`Expanding: ${sectionTitle}`);
      await expandSection(section);
      await sleep(500);

      const lectures = getVideoLecturesFromSection(section);

      for (let lectureIdx = 0; lectureIdx < lectures.length; lectureIdx++) {
        if (shouldStopAutoCapture) break;

        const lecture = lectures[lectureIdx];
        totalProcessed++;

        updateAutoCaptureStatus(
          `[${totalProcessed}] ${lecture.title.substring(0, 40)}...`,
        );

        // Check if already captured
        const saved = JSON.parse(
          localStorage.getItem("udemy_subtitles") || "[]",
        );
        const alreadyCaptured = saved.some((s) =>
          s.title.includes(lecture.title.replace(/^\d+\.\s*/, "")),
        );

        if (alreadyCaptured) {
          totalSkipped++;
          continue;
        }

        // Click the lecture
        lecture.element.click();
        await sleep(2000);

        // Wait for subtitle capture
        const result = await waitForSubtitleCapture(30000);

        if (result.success) {
          totalCaptured++;
        } else if (result.reason === "timeout") {
          totalTimeout++;
          skippedVideos.push({
            title: lecture.title,
            section: sectionTitle,
            reason: "timeout",
          });
        } else if (result.reason === "stopped") {
          break;
        }

        updateButtonCount();
        await sleep(500);
      }
    }

    isAutoCaptureRunning = false;
    updateAutoCaptureButtonState();

    updateAutoCaptureStatus("Completed!");
    alert(
      `Auto-capture completed!\n\nCaptured: ${totalCaptured}\nSkipped: ${totalSkipped}\nTimeout: ${totalTimeout}`,
    );
  }

  // Stop auto-capture
  function stopAutoCapture() {
    shouldStopAutoCapture = true;
    updateAutoCaptureStatus("Stopping...");
  }

  // Update button state
  function updateAutoCaptureButtonState() {
    const startBtn = document.getElementById("auto-capture-start-btn");
    const stopBtn = document.getElementById("auto-capture-stop-btn");

    if (startBtn && stopBtn) {
      startBtn.style.display = isAutoCaptureRunning ? "none" : "flex";
      stopBtn.style.display = isAutoCaptureRunning ? "flex" : "none";
    }
  }

  // Expose
  window.downloadAllAsZip = downloadAllAsZip;
  window.clearSubtitles = clearSubtitles;
  window.startAutoCapture = startAutoCapture;
  window.stopAutoCapture = stopAutoCapture;

  // Button
  function createFloatingButton() {
    // Add styles to head
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes usd-fade-in {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes usd-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      @keyframes usd-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      #usd-panel {
        animation: usd-fade-in 0.3s ease-out;
      }
      #usd-panel * {
        box-sizing: border-box;
      }
      .usd-btn {
        position: relative;
        overflow: hidden;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .usd-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      .usd-btn:active {
        transform: translateY(0);
      }
      .usd-btn-primary:hover { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%) !important; }
      .usd-btn-secondary:hover { background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%) !important; }
      .usd-btn-danger:hover { background: linear-gradient(135deg, #e11d48 0%, #be123c 100%) !important; }
      .usd-btn-ghost:hover { background: rgba(20,184,166,0.1) !important; border-color: rgba(20,184,166,0.3) !important; color: #14b8a6 !important; }
      #usd-panel-toggle:hover { background: rgba(255,255,255,0.1); }
      .usd-capturing { animation: usd-pulse 1.5s infinite; }
    `;
    document.head.appendChild(styleSheet);

    const container = document.createElement("div");
    container.innerHTML = `
      <div id="usd-panel" style="
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
        font-size: 14px;
        -webkit-font-smoothing: antialiased;
      ">
        <!-- Main Card -->
        <div id="usd-card" style="
          background: linear-gradient(145deg, rgba(30,32,36,0.98) 0%, rgba(20,22,26,0.98) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset;
          width: 300px;
          overflow: hidden;
        ">
          <!-- Header -->
          <div style="
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            display: flex;
            align-items: center;
            justify-content: space-between;
          ">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="
                width: 32px;
                height: 32px;
                background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
              ">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </div>
              <div>
                <div style="color: #fff; font-weight: 600; font-size: 14px; letter-spacing: -0.2px;">Subtitle Capture</div>
                <div style="color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 1px;">Udemy Course Tool</div>
              </div>
            </div>
            <div id="subtitle-count" style="
              background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
              color: white;
              padding: 4px 10px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              min-width: 24px;
              text-align: center;
            ">0</div>
          </div>

          <!-- Status Area -->
          <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);">
            <div id="auto-capture-status" style="
              background: rgba(255,255,255,0.03);
              border: 1px solid rgba(255,255,255,0.06);
              padding: 12px 14px;
              border-radius: 10px;
              font-size: 12px;
              color: rgba(255,255,255,0.5);
              min-height: 44px;
              display: flex;
              align-items: center;
            ">
              <span style="
                width: 6px;
                height: 6px;
                background: #14b8a6;
                border-radius: 50%;
                margin-right: 10px;
                flex-shrink: 0;
              "></span>
              Ready to capture
            </div>
          </div>

          <!-- Actions -->
          <div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 10px;">
            <button id="auto-capture-start-btn" class="usd-btn usd-btn-primary" style="
              background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
              color: white;
              border: none;
              padding: 12px 16px;
              border-radius: 10px;
              cursor: pointer;
              font-weight: 600;
              font-size: 13px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              letter-spacing: -0.2px;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Start Auto-Capture
            </button>

            <button id="auto-capture-stop-btn" class="usd-btn usd-btn-danger" style="
              background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
              color: white;
              border: none;
              padding: 12px 16px;
              border-radius: 10px;
              cursor: pointer;
              font-weight: 600;
              font-size: 13px;
              display: none;
              align-items: center;
              justify-content: center;
              gap: 8px;
              letter-spacing: -0.2px;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1"/>
              </svg>
              Stop Capture
            </button>

            <button id="udemy-subtitle-btn" class="usd-btn usd-btn-secondary" style="
              background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
              color: white;
              border: none;
              padding: 12px 16px;
              border-radius: 10px;
              cursor: pointer;
              font-weight: 600;
              font-size: 13px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              letter-spacing: -0.2px;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download ZIP
            </button>

            <button id="clear-subtitles-btn" class="usd-btn usd-btn-ghost" style="
              background: transparent;
              color: rgba(255,255,255,0.5);
              border: 1px solid rgba(255,255,255,0.1);
              padding: 10px 14px;
              border-radius: 10px;
              cursor: pointer;
              font-size: 12px;
              font-weight: 500;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
            ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Clear All
            </button>
          </div>

          <!-- Footer -->
          <div style="
            padding: 12px 20px;
            background: rgba(0,0,0,0.2);
            border-top: 1px solid rgba(255,255,255,0.04);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          ">
            <span style="color: rgba(255,255,255,0.25); font-size: 10px;">v${VERSION}</span>
            <span style="color: rgba(255,255,255,0.15);">•</span>
            <span style="color: rgba(255,255,255,0.25); font-size: 10px;">by oaslan</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Event listeners
    document
      .getElementById("auto-capture-start-btn")
      .addEventListener("click", startAutoCapture);
    document
      .getElementById("auto-capture-stop-btn")
      .addEventListener("click", stopAutoCapture);
    document
      .getElementById("udemy-subtitle-btn")
      .addEventListener("click", downloadAllAsZip);
    document
      .getElementById("clear-subtitles-btn")
      .addEventListener("click", () => {
        if (confirm("Clear all captured subtitles?")) {
          clearSubtitles();
        }
      });

    updateButtonCount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () =>
      setTimeout(createFloatingButton, 2000),
    );
  } else {
    setTimeout(createFloatingButton, 2000);
  }
})();
