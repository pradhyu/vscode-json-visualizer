# Requirements Document

## Introduction

This feature involves creating a VSCode extension that can parse JSON files containing medical claims data and display them in an interactive timeline chart. The extension will support multiple types of medical data including prescription claims (rxTba, rxHistory) and medical claims (medHistory) with configurable date mappings for timeline visualization.

## Requirements

### Requirement 1

**User Story:** As a healthcare data analyst, I want to open JSON files containing medical claims data in VSCode, so that I can visualize the timeline of medical events for patients.

#### Acceptance Criteria

1. WHEN a user opens a JSON file with medical claims data THEN the extension SHALL detect the file format and offer to display it in timeline view
2. WHEN the extension detects supported medical claims structure THEN it SHALL automatically parse rxTba, rxHistory, and medHistory arrays
3. IF the JSON file contains the expected medical claims structure THEN the extension SHALL provide a "View Timeline" command in the command palette

### Requirement 2

**User Story:** As a healthcare data analyst, I want to see prescription claims (rxTba and rxHistory) displayed on a timeline, so that I can understand the medication history and timing.

#### Acceptance Criteria

1. WHEN displaying rxTba array items THEN the extension SHALL use dos (date of service) as start date and dos + dayssupply as end date
2. WHEN displaying rxHistory array items THEN the extension SHALL use dos (date of service) as start date and dos + dayssupply as end date
3. WHEN prescription claims overlap in time THEN the extension SHALL display them in separate lanes to avoid visual conflicts
4. WHEN a prescription claim is displayed THEN it SHALL show relevant details like medication name, dosage, and supply duration

### Requirement 3

**User Story:** As a healthcare data analyst, I want to see medical claims (medHistory) displayed on a timeline, so that I can understand the medical service history.

#### Acceptance Criteria

1. WHEN displaying medHistory claims THEN the extension SHALL navigate to claims[].lines[] structure
2. WHEN processing medical claim lines THEN the extension SHALL use lines[].srvcStart as start date and lines[].srvcEnd as end date
3. WHEN medical claims overlap in time THEN the extension SHALL display them in separate lanes to avoid visual conflicts
4. WHEN a medical claim is displayed THEN it SHALL show relevant details like service type, provider, and claim amount

### Requirement 4

**User Story:** As a healthcare data analyst, I want to configure which JSON attributes contain the medical claims arrays, so that I can use the extension with different data formats.

#### Acceptance Criteria

1. WHEN the extension starts THEN it SHALL provide configuration options for specifying array attribute names
2. WHEN configuration is changed THEN the extension SHALL allow users to specify custom paths for rxTba, rxHistory, and medHistory arrays
3. IF custom attribute paths are configured THEN the extension SHALL use those paths instead of default ones
4. WHEN invalid configuration is provided THEN the extension SHALL display helpful error messages

### Requirement 5

**User Story:** As a healthcare data analyst, I want an interactive timeline chart with zoom and pan capabilities, so that I can examine different time periods in detail.

#### Acceptance Criteria

1. WHEN the timeline is displayed THEN the extension SHALL provide zoom in/out functionality
2. WHEN the timeline is displayed THEN the extension SHALL provide horizontal panning capability
3. WHEN hovering over timeline items THEN the extension SHALL display detailed information in tooltips
4. WHEN clicking on timeline items THEN the extension SHALL show expanded details in a side panel
5. WHEN the timeline is displayed THEN it SHALL show the most recent entries first and arrange past claims chronologically
6. WHEN different claim types are displayed THEN each type SHALL have a distinct color (rxTba, rxHistory, medHistory)
7. WHEN the timeline is rendered THEN it SHALL include a legend showing claim types and their corresponding colors

### Requirement 6

**User Story:** As a developer testing the extension, I want sample JSON files with realistic medical claims data, so that I can test and demonstrate the extension functionality.

#### Acceptance Criteria

1. WHEN the extension is installed THEN it SHALL include sample JSON files with rxTba data
2. WHEN the extension is installed THEN it SHALL include sample JSON files with rxHistory data  
3. WHEN the extension is installed THEN it SHALL include sample JSON files with medHistory data
4. WHEN sample files are provided THEN they SHALL contain realistic date ranges and medical terminology
5. WHEN sample files are opened THEN they SHALL demonstrate all supported timeline visualization features