/**
 * Copyright (c) 2025 ozziehouso
 *
 * This file is part of a project that can be used and adapted via pull requests.
 * Redistribution or recreation of this code as a separate project is prohibited.
 * See LICENSE file for details.
 */

export const DAYZ_FUNCTIONS = {
  HEAVY_FUNCTIONS: [
    'GetPlayers',
    'GetObjectsAtPosition',
    'GetGame().GetPlayers',
    'GetGame().GetObjectsAtPosition',
    'AllPlayers',
    'GetPlayerList'
  ],

  RESOURCE_FUNCTIONS: {
    'CallLater': 'Remove',
    'CallLaterByName': 'Remove',
    'OpenFile': 'CloseFile',
    'RegisterNetSyncVariableInt': null,
    'RegisterNetSyncVariableBool': null
  },

  BLOCKING_FUNCTIONS: [
    'Sleep',
    'SleepEx'
  ],

  NETWORK_FUNCTIONS: [
    'SendRPC',
    'ScriptRPC',
    'GetRPCManager',
    'RPCSingleParam',
    'RPCEx'
  ],

  // File I/O functions
  FILE_IO_FUNCTIONS: [
    'FPrintln',
    'FPrint',
    'OpenFile',
    'JsonFileLoader',
    'JsonSerializer'
  ]
};

export const DAYZ_PATTERNS = {
  RECOMMENDED_UPDATE_INTERVALS: {
    playerStats: 30000,
    gameplayUpdates: 1000,
    systemUpdates: 500,
    guiUpdates: 100
  },

  CLEANUP_PATTERNS: [
    /GetGame\(\)\.GetCallQueue\([^)]+\)\.Remove\(/,
    /CloseFile\s*\(/,
    /void\s+~[A-Za-z_][A-Za-z0-9_]*/
  ],

  RATE_LIMITING_PATTERN: /if\s*\([^)]*GetTime[^)]*[<>]/,

  CALLLATER_USAGE: /GetGame\(\)\.GetCallQueue\(CALL_CATEGORY_[A-Z_]+\)\.CallLater/
};

export const SAFE_PATTERNS = {
  INIT_SCANS: [
    /void\s+OnInit\s*\(/,
    /void\s+Init\s*\(/,
    /void\s+OnMissionStart\s*\(/
  ],

  SCHEDULED_UPDATES: [
    /CallLater\s*\([^,]+,\s*30000/,
    /CallLater\s*\([^,]+,\s*1000/,
  ]
};

export const COMMON_MISTAKES = {
  MISSING_SUPER: {
    pattern: /override\s+void\s+(OnInit|OnUpdate|OnMissionStart|EEInit)/,
    requiresSuper: true
  },

  WRONG_CATEGORY: {
    pattern: /CallQueue\(CALL_CATEGORY_SYSTEM\).*Update/,
    suggestion: 'Use CALL_CATEGORY_GAMEPLAY for game logic updates'
  },

  GETGAME_CACHE: {
    pattern: /GetGame\(\)/,
    suggestion: 'Consider caching GetGame() result in frequently-called functions'
  }
};

export const BEST_PRACTICES = {
  SCHEDULER: {
    description: 'Use scheduler pattern for processing large arrays',
    example: 'const int SCHEDULER_PLAYERS_PER_TICK = 5;'
  },

  CATEGORY_USAGE: {
    CALL_CATEGORY_GAMEPLAY: 'Game logic, player updates',
    CALL_CATEGORY_SYSTEM: 'System-level operations',
    CALL_CATEGORY_GUI: 'UI updates'
  },

  TIMESLICE_USAGE: {
    description: 'Use timeslice parameter in OnUpdate',
    pattern: /override\s+void\s+OnUpdate\s*\(\s*float\s+timeslice\s*\)/
  }
};

export const VANILLA_SIGNATURES = {
  'OnInit': 'void OnInit()',
  'OnUpdate': 'void OnUpdate(float timeslice)',
  'OnMissionStart': 'void OnMissionStart()',
  'OnMissionFinish': 'void OnMissionFinish()',
  'EEInit': 'override void EEInit()',
  'EEDelete': 'override void EEDelete(EntityAI parent)'
};
