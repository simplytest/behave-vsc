import { Uri } from "vscode";

export enum Status
{
    UNTESTED = "untested",
    SKIPPED = "skipped",
    PASSED = "passed",
    FAILED = "failed",
}

export enum Keyword
{
    FEATURE = "Feature",
    SCENARIO = "Scenario",
    OUTLINE = "Scenario Outline",
    WHEN = "When",
    THEN = "Then",
}

export interface Location
{
    file: string;
    line: number;
    bare: string;
    full: Uri;
}

export interface Result
{
    status: Status;
    duration: number;
    error_message?: string[];
}

export interface Match
{
    location: Location;
}

interface Common
{
    keyword: Keyword;
    name: string;
    location: Location;
}

export interface Step extends Common
{
    match?: Match;
    result?: Result;
    step_type: string;
}

export interface Scenario extends Common
{
    status: Status;
    steps: Step[];
    tags: string[];
}

export interface Feature extends Common
{
    status: Status;
    tags: string[];
    elements: Scenario[];
}

export type Tree = Feature[];

export type Item = Step | Scenario | Feature;
export type Locatable = Match | Step | Scenario | Feature;
