/**
 * Copyright (c) 2025 ozziehouso
 *
 * This file is part of a project that can be used and adapted via pull requests.
 * Redistribution or recreation of this code as a separate project is prohibited.
 * See LICENSE file for details.
 */

let selectedFile = null;

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFile');
const analyzeBtn = document.getElementById('analyzeBtn');
const analyzing = document.getElementById('analyzing');
const errorDiv = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');
const results = document.getElementById('results');

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
removeFileBtn.addEventListener('click', clearFile);
analyzeBtn.addEventListener('click', analyzeFile);

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('border-blue-500');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('border-blue-500');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    if (!file.name.endsWith('.zip')) {
        showError('Please select a .zip file');
        return;
    }

    if (file.size > 50 * 1024 * 1024) {
        showError('File too large (max 50MB)');
        return;
    }

    selectedFile = file;

    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    fileInfo.classList.remove('hidden');
    analyzeBtn.classList.remove('hidden');
    uploadArea.classList.add('hidden');
    errorDiv.classList.add('hidden');
    results.classList.add('hidden');
}

function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    analyzeBtn.classList.add('hidden');
    uploadArea.classList.remove('hidden');
}

async function analyzeFile() {
    if (!selectedFile) return;

    analyzeBtn.disabled = true;
    analyzing.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    results.classList.add('hidden');

    try {
        const formData = new FormData();
        formData.append('modFile', selectedFile);

        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Analysis failed');
        }

        if (!data.success) {
            throw new Error(data.error || 'Analysis failed');
        }

        displayResults(data);

    } catch (err) {
        showError(err.message);
    } finally {
        analyzeBtn.disabled = false;
        analyzing.classList.add('hidden');
    }
}

function displayResults(data) {
    updateScore(data.score, data.rating);

    document.getElementById('totalFiles').textContent = data.summary.totalFiles;
    document.getElementById('totalIssues').textContent = data.summary.totalIssues;
    document.getElementById('criticalCount').textContent = data.summary.critical;
    document.getElementById('highCount').textContent = data.summary.high;
    document.getElementById('mediumCount').textContent = data.summary.medium;
    document.getElementById('lowCount').textContent = data.summary.low;

    displayIssues(data.issues, data.summary);
    displayRecommendations(data.summary);

    results.classList.remove('hidden');
    results.scrollIntoView({ behavior: 'smooth' });
}

function updateScore(score, rating) {
    const scoreValue = document.getElementById('scoreValue');
    const scoreRating = document.getElementById('scoreRating');
    const scoreProgress = document.getElementById('scoreProgress');

    scoreValue.textContent = score;
    scoreRating.textContent = rating;

    // Color based on rating
    let color = '#10b981'; // green
    if (score < 90) color = '#eab308'; // yellow
    if (score < 75) color = '#f59e0b'; // orange
    if (score < 60) color = '#ef4444'; // red
    if (score < 40) color = '#dc2626'; // dark red

    scoreProgress.style.stroke = color;
    scoreRating.style.color = color;

    // Animate circle (radius 88, so circumference = 2 * π * 88 = 552.92)
    const circumference = 552.92;
    const offset = circumference - (score / 100) * circumference;
    scoreProgress.style.strokeDashoffset = offset;
}

function displayIssues(issues, summary) {
    const issuesList = document.getElementById('issuesList');
    const issuesSection = document.getElementById('issuesSection');

    if (summary.totalIssues === 0) {
        issuesList.innerHTML = `
            <div class="text-center py-12">
                <div class="inline-block p-4 bg-green-500/20 rounded-full mb-4">
                    <svg class="h-16 w-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <p class="text-2xl font-bold text-green-400 mb-2">No potential performance issues detected!</p>
                <p class="text-gray-400">Your mod looks well-optimized.</p>
            </div>
        `;
        return;
    }

    // Group issues by severity
    const grouped = {
        CRITICAL: [],
        HIGH: [],
        MEDIUM: [],
        LOW: [],
        INFO: []
    };

    issues.forEach(fileResult => {
        fileResult.issues.forEach(issue => {
            grouped[issue.severity].push({
                ...issue,
                file: fileResult.file
            });
        });
    });

    // Build HTML
    let html = '';

    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].forEach(severity => {
        if (grouped[severity].length === 0) return;

        const config = getSeverityConfig(severity);

        html += `
            <div class="mb-8">
                <div class="flex items-center mb-4">
                    <span class="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold ${config.badge}">
                        ${severity}
                    </span>
                    <span class="ml-3 text-gray-400">${grouped[severity].length} issue${grouped[severity].length > 1 ? 's' : ''}</span>
                </div>
                <div class="space-y-4">
                    ${grouped[severity].map(issue => `
                        <div class="border-l-4 ${config.border} bg-slate-800/50 backdrop-blur-sm p-5 rounded-r-xl hover:bg-slate-800 transition-colors">
                            <div class="flex items-start gap-4">
                                <div class="flex-shrink-0">
                                    <svg class="h-6 w-6 ${config.icon}" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                                    </svg>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="text-base font-bold text-white mb-2">${issue.ruleName}</h4>
                                    <p class="text-sm text-gray-300 mb-2">${issue.message}</p>
                                    <div class="flex items-center gap-2 text-xs">
                                        <svg class="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/>
                                        </svg>
                                        <code class="text-gray-400 font-mono">
                                            ${issue.file}${issue.line ? `:${issue.line}` : ''}
                                        </code>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    issuesList.innerHTML = html;
}

function displayRecommendations(summary) {
    const recommendations = document.getElementById('recommendations');
    let html = '';

    if (summary.critical > 0) {
        html += `
            <div class="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <svg class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                <p class="text-red-300">
                    <strong>CRITICAL patterns detected</strong> - These are likely to cause server performance issues.
                    Recommended: Review and address before deploying to production.
                </p>
            </div>
        `;
    }

    if (summary.high > 0) {
        html += `
            <div class="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <svg class="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                <p class="text-orange-300">
                    <strong>HIGH severity patterns</strong> may cause significant performance problems.
                    Recommended: Review and optimize before production use.
                </p>
            </div>
        `;
    }

    if (summary.medium > 0) {
        html += `
            <div class="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <svg class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                </svg>
                <p class="text-yellow-300">
                    <strong>MEDIUM patterns detected</strong> that could cause issues under load.
                    Recommended: Consider addressing these for optimal performance.
                </p>
            </div>
        `;
    }

    if (summary.low > 0 || summary.info > 0) {
        html += `
            <div class="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <svg class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                </svg>
                <p class="text-blue-300">
                    <strong>Minor optimization opportunities detected.</strong>
                    Optional: Review when time permits.
                </p>
            </div>
        `;
    }

    if (summary.totalIssues === 0) {
        html = `
            <div class="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <svg class="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <p class="text-green-300">
                    <strong>Excellent!</strong> No potential performance issues detected.
                </p>
            </div>
        `;
    }

    recommendations.innerHTML = html;
}

// Helpers
function getSeverityConfig(severity) {
    const configs = {
        CRITICAL: {
            badge: 'bg-red-500/20 text-red-400 border border-red-500/50',
            border: 'border-red-500',
            icon: 'text-red-400'
        },
        HIGH: {
            badge: 'bg-orange-500/20 text-orange-400 border border-orange-500/50',
            border: 'border-orange-500',
            icon: 'text-orange-400'
        },
        MEDIUM: {
            badge: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50',
            border: 'border-yellow-500',
            icon: 'text-yellow-400'
        },
        LOW: {
            badge: 'bg-blue-500/20 text-blue-400 border border-blue-500/50',
            border: 'border-blue-500',
            icon: 'text-blue-400'
        },
        INFO: {
            badge: 'bg-gray-500/20 text-gray-400 border border-gray-500/50',
            border: 'border-gray-500',
            icon: 'text-gray-400'
        }
    };
    return configs[severity] || configs.INFO;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showError(message) {
    errorMessage.textContent = message;
    errorDiv.classList.remove('hidden');
}
