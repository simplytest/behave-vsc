enum Status
{
    // TODO: There are  more status values!
    UNTESTED = "untested",
    SKIPPED = "skipped",
    PASSED = "passed",
    FAILED = "failed",
}

export interface Location
{
    file: string;
    line: number;
    path: string;
}

export interface Result
{
    status: Status;
    duration: number;
}

interface ItemBase
{
    name: string;
    location: Location;
}

export interface Step extends ItemBase
{
    result: Result;
    keyword: string;
}

export interface Scenario extends ItemBase
{
    status: string;
    steps: Step[];
    tags: string[];
}

export interface Feature extends ItemBase
{
    status: string;
    tags: string[];
    elements: Scenario[];
}

export type BehaveItem = Feature | Scenario | Step;
