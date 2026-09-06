import React from 'react';
import { SmartShiftTracker, SmartShiftTrackerProps } from './SmartShiftTracker';

export type LiveTrackerPanelProps = SmartShiftTrackerProps;

/**
 * LiveTrackerPanel is maintained as a backward-compatible wrapper
 * around the enhanced SmartShiftTracker component.
 */
export const LiveTrackerPanel: React.FC<LiveTrackerPanelProps> = (props) => {
  return <SmartShiftTracker {...props} />;
};

export default LiveTrackerPanel;
