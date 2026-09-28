const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
    const mdPath = path.join(__dirname, 'LOCALSHOP_MASTER_DOCUMENTATION.md');
    const htmlPath = path.join(__dirname, 'LOCALSHOP_MASTER_DOCUMENTATION.html');
    const pdfPath = path.join(__dirname, 'LOCALSHOP_MASTER_DOCUMENTATION.pdf');

    if (!fs.existsSync(mdPath)) {
        console.error(`Error: ${mdPath} not found!`);
        process.exit(1);
    }

    const mdContent = fs.readFileSync(mdPath, 'utf8');

    // Dynamically import marked or use marked via npx
    let htmlBody = '';
    try {
        const { marked } = await import('marked');
        htmlBody = marked.parse(mdContent);
    } catch (e) {
        // Fallback: run marked via npx
        console.log('Using npx marked...');
        htmlBody = execSync('npx -y marked', { input: mdContent, encoding: 'utf8' });
    }

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LocalShop - Master Application Documentation & User Guide</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        @page {
            size: A4;
            margin: 18mm 16mm 18mm 16mm;
            @bottom-right {
                content: counter(page);
            }
        }

        *, *::before, *::after {
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1e293b;
            background-color: #ffffff;
            line-height: 1.55;
            font-size: 13px;
            margin: 0;
            padding: 0;
        }

        .header-banner {
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 12px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }

        .header-title {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.5px;
        }

        .header-subtitle {
            margin: 4px 0 0 0;
            font-size: 13px;
            color: #64748b;
            font-weight: 500;
        }

        .meta-badge {
            background: #eff6ff;
            color: #1d4ed8;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            border: 1px solid #bfdbfe;
            white-space: nowrap;
        }

        h1 {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            border-bottom: 1.5px solid #e2e8f0;
            padding-bottom: 6px;
            margin-top: 28px;
            margin-bottom: 14px;
            page-break-after: avoid;
        }

        h2 {
            font-size: 16px;
            font-weight: 700;
            color: #1e293b;
            border-left: 3px solid #3b82f6;
            padding-left: 8px;
            margin-top: 22px;
            margin-bottom: 10px;
            page-break-after: avoid;
        }

        h3 {
            font-size: 14px;
            font-weight: 700;
            color: #334155;
            margin-top: 18px;
            margin-bottom: 8px;
            page-break-after: avoid;
        }

        h4 {
            font-size: 13px;
            font-weight: 700;
            color: #475569;
            margin-top: 14px;
            margin-bottom: 6px;
            page-break-after: avoid;
        }

        p {
            margin-top: 0;
            margin-bottom: 10px;
            text-align: justify;
        }

        ul, ol {
            margin-top: 0;
            margin-bottom: 12px;
            padding-left: 22px;
        }

        li {
            margin-bottom: 4px;
        }

        hr {
            border: 0;
            height: 1px;
            background: #e2e8f0;
            margin: 20px 0;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 14px 0;
            font-size: 12px;
            page-break-inside: avoid;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            overflow: hidden;
        }

        th, td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
        }

        th {
            background-color: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            font-size: 11.5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #cbd5e1;
        }

        tr:nth-child(even) td {
            background-color: #f8fafc;
        }

        tr:last-child td {
            border-bottom: none;
        }

        code {
            font-family: "Cascadia Code", "Fira Code", Consolas, Monaco, monospace;
            font-size: 11px;
            background: #f1f5f9;
            color: #0f172a;
            padding: 2px 5px;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
        }

        pre {
            background: #0f172a;
            color: #f8fafc;
            padding: 12px 14px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 11.5px;
            line-height: 1.45;
            margin: 12px 0;
            page-break-inside: avoid;
        }

        pre code {
            background: transparent;
            color: inherit;
            padding: 0;
            border: none;
            font-size: inherit;
        }

        .mermaid {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px;
            margin: 16px 0;
            text-align: center;
            page-break-inside: avoid;
        }

        .mermaid svg {
            max-width: 100% !important;
            height: auto !important;
        }

        blockquote {
            border-left: 4px solid #3b82f6;
            background: #eff6ff;
            margin: 12px 0;
            padding: 8px 14px;
            border-radius: 0 6px 6px 0;
            font-style: italic;
            color: #1e40af;
        }

        .page-break {
            page-break-before: always;
        }

        a {
            color: #2563eb;
            text-decoration: none;
            font-weight: 500;
        }

        a:hover {
            text-decoration: underline;
        }

        .footer {
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            font-size: 10.5px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
        }
    </style>
</head>
<body>
    <div class="header-banner">
        <div>
            <div class="header-title">LocalShop (LocalStore)</div>
            <div class="header-subtitle">System Architecture, Feature Specifications & Comprehensive User Guide</div>
        </div>
        <div class="meta-badge">Release v1.0.0 &bull; Expo SDK 57 / .NET 9</div>
    </div>

    <div id="content">
        ${htmlBody}
    </div>

    <div class="footer">
        <span>LocalShop Quick-Commerce Platform Documentation</span>
        <span>Generated for Android / iOS / Web &bull; Confidential & Internal</span>
    </div>

    <script>
        document.querySelectorAll('pre code.language-mermaid').forEach((el) => {
            const parent = el.parentElement;
            const div = document.createElement('div');
            div.className = 'mermaid';
            div.textContent = el.textContent;
            parent.replaceWith(div);
        });

        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            },
            sequence: {
                useMaxWidth: true,
                showSequenceNumbers: true
            }
        });
    </script>
</body>
</html>`;

    fs.writeFileSync(htmlPath, fullHtml, 'utf8');
    console.log(`Generated HTML at: ${htmlPath}`);

    // Call Microsoft Edge to render PDF
    const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
    const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
    console.log(`Generating PDF via Edge: ${fileUrl}`);

    const cmd = `cmd /c ""${edgePath}" --headless=new --disable-gpu --virtual-time-budget=8000 --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${fileUrl}""`;
    
    try {
        const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
        console.log(output);
    } catch (err) {
        console.log('Edge execution log:', err.stdout ? err.stdout.toString() : '', err.stderr ? err.stderr.toString() : '');
    }

    if (fs.existsSync(pdfPath)) {
        const stats = fs.statSync(pdfPath);
        console.log(`SUCCESS: PDF generated at ${pdfPath} (${stats.size} bytes)`);
    } else {
        console.error('ERROR: PDF was not created!');
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
