import { Uri } from "vscode";

export enum Status
{
    // TODO: There are  more status values!
    UNTESTED = "untested",
    SKIPPED = "skipped",
    PASSED = "passed",
    FAILED = "failed",
}

export enum Keyword
{
    FEATURE = "Feature",
    SCENARIO = "Scenario",
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
    error_message?: string[]; // TODO: Allow typings to detect that this exists if status is failed
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
    result?: Result;
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

export type Item = Feature | Scenario | Step;
export type Node = Item | Result | Match;
