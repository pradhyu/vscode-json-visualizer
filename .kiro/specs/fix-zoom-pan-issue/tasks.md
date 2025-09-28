# Implementation Plan

- [x] 1. Restructure timeline container hierarchy for proper zoom behavior
  - Modify the timeline rendering code to create a dedicated zoom container group
  - Move all timeline elements (claim bars, grid lines) into the zoom container
  - Keep axes outside the zoom container so they can be updated independently
  - _Requirements: 1.4, 2.3_

- [x] 2. Fix the zoom event handler to use CSS transforms
  - Replace manual element position updates with container transform application
  - Remove the individual claim bar position updates from handleZoom function
  - Apply the zoom transform directly to the zoom container group
  - _Requirements: 1.1, 1.4, 2.1, 2.3_

- [x] 3. Implement proper axis rescaling during zoom events
  - Update x-axis using rescaled xScale from zoom transform
  - Update y-axis using rescaled yScale from zoom transform
  - Ensure axis updates don't interfere with container transform
  - Add adaptive tick formatting based on zoom level
  - _Requirements: 1.5_

- [-] 4. Fix zoom control button implementations
  - Update zoom in/out buttons to use D3's scaleBy method
  - Update pan buttons to use D3's translateBy method
  - Update reset button to use proper transform identity
  - Update zoom-to-fit to calculate and apply optimal transform
  - _Requirements: 1.2, 1.3, 2.2, 3.4, 3.5_

- [ ] 5. Implement zoom level indicator updates
  - Update the zoom percentage display during zoom events
  - Ensure the indicator shows accurate zoom levels
  - Add proper formatting for zoom percentage display
  - _Requirements: 3.1_

- [ ] 6. Add zoom constraint and boundary handling
  - Implement pan boundaries to prevent excessive panning
  - Ensure zoom limits are properly enforced
  - Add visual feedback when limits are reached
  - _Requirements: 2.4, 3.2_

- [ ] 7. Fix keyboard shortcut handling for zoom/pan
  - Ensure keyboard shortcuts trigger the same zoom behavior as buttons
  - Test and fix +, -, 0, F key functionality
  - Add Shift+arrow key support for panning
  - _Requirements: 3.3_

- [ ] 8. Ensure zoom/pan state persistence across view modes
  - Preserve zoom transform when switching between Timeline/Table/Both views
  - Ensure zoom behavior is properly reinitialized when view changes
  - Test that zoom state is maintained during view transitions
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 9. Add visual feedback for zoom/pan operations
  - Implement cursor changes during zoom and pan operations
  - Add smooth transitions for programmatic zoom/pan operations
  - Ensure visual feedback is consistent across all interaction methods
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_

- [ ] 10. Test and validate zoom/pan functionality
  - Create test cases for zoom behavior with different data sets
  - Test zoom/pan performance with large numbers of claims
  - Verify smooth operation across different browsers and devices
  - Test edge cases like empty data sets and extreme zoom levels
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_