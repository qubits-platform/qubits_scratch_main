import { defineMessages, injectIntl, intlShape } from 'react-intl'
import PropTypes from 'prop-types'
import React from 'react'
import { connect } from 'react-redux'
import VM from 'scratch-vm'

import Box from '../box/box.jsx'
import Button from '../button/button.jsx'
import ToggleButtons from '../toggle-buttons/toggle-buttons.jsx'
import Controls from '../../containers/controls.jsx'
import { getStageDimensions } from '../../lib/screen-utils'
import { STAGE_SIZE_MODES } from '../../lib/layout-constants'

import fullScreenIcon from './icon--fullscreen.svg'
import largeStageIcon from './icon--large-stage.svg'
import smallStageIcon from './icon--small-stage.svg'
import unFullScreenIcon from './icon--unfullscreen.svg'

import scratchLogo from '../menu-bar/scratch-logo.svg'
import styles from './stage-header.css'

const messages = defineMessages({
  largeStageSizeMessage: {
    defaultMessage: 'Switch to large stage',
    description: 'Button to change stage size to large',
    id: 'gui.stageHeader.stageSizeLarge',
  },
  smallStageSizeMessage: {
    defaultMessage: 'Switch to small stage',
    description: 'Button to change stage size to small',
    id: 'gui.stageHeader.stageSizeSmall',
  },
  fullStageSizeMessage: {
    defaultMessage: 'Enter full screen mode',
    description: 'Button to change stage size to full screen',
    id: 'gui.stageHeader.stageSizeFull',
  },
  unFullStageSizeMessage: {
    defaultMessage: 'Exit full screen mode',
    description: 'Button to get out of full screen mode',
    id: 'gui.stageHeader.stageSizeUnFull',
  },
  fullscreenControl: {
    defaultMessage: 'Full Screen Control',
    description: 'Button to enter/exit full screen mode',
    id: 'gui.stageHeader.fullscreenControl',
  },
})

const StageHeaderComponent = function (props) {
  const {
    isFullScreen,
    isPlayerOnly,
    onKeyPress,
    onSetStageLarge,
    onSetStageSmall,
    onSetStageFull,
    onSetStageUnFull,
    showBranding,
    stageSizeMode,
    vm,
    spriteClicked,
    flagClicked,
    currentLayout,
  } = props

  let header = null

  if (isFullScreen) {
    const stageDimensions = getStageDimensions(null, true)
    const stageButton = showBranding ? (
      <div className={styles.embedScratchLogo}>
        <a href='https://scratch.mit.edu' rel='noopener noreferrer' target='_blank'>
          <img alt='Scratch' src={scratchLogo} />
        </a>
      </div>
    ) : (
      <div className={styles.unselectWrapper}>
        <Button className={styles.stageButton} onClick={onSetStageUnFull} onKeyPress={onKeyPress}>
          <img
            alt={props.intl.formatMessage(messages.unFullStageSizeMessage)}
            className={styles.stageButtonIcon}
            draggable={false}
            src={unFullScreenIcon}
            title={props.intl.formatMessage(messages.fullscreenControl)}
          />
        </Button>
      </div>
    )
    header = (
      <Box className={styles.stageHeaderWrapperOverlay}>
        <Box className={styles.stageMenuWrapper} style={{ width: stageDimensions.width }}>
          <Controls vm={vm} currentLayout={currentLayout}/>
          {stageButton}
        </Box>
      </Box>
    )
  } else {
    const stageControls = isPlayerOnly ? (
      []
    ) : (
      <div className={styles.stageSizeToggleGroup}>
        <ToggleButtons
          buttons={[
            {
              handleClick: onSetStageSmall,
              icon: smallStageIcon,
              iconClassName: styles.stageButtonIcon,
              isSelected: stageSizeMode === STAGE_SIZE_MODES.small,
              title: props.intl.formatMessage(messages.smallStageSizeMessage),
            },
            {
              handleClick: onSetStageLarge,
              icon: largeStageIcon,
              iconClassName: styles.stageButtonIcon,
              isSelected: stageSizeMode === STAGE_SIZE_MODES.large,
              title: props.intl.formatMessage(messages.largeStageSizeMessage),
            },
          ]}
        />
      </div>
    )
    header = (
      <Box className={currentLayout==="teacher" || currentLayout==="student" ? styles.stageHeaderWrapperLayout :styles.stageHeaderWrapper}>
        <Box className={styles.stageMenuWrapper}>
          <Controls vm={vm} currentLayout={currentLayout}/>
          <div className={currentLayout==="teacher" || currentLayout==="student" ? styles.stageSizeRowStudent :styles.stageSizeRow} >
            <div className={styles.stageControlsDisplay}>{stageControls}</div>
            <div className={styles.stageControlsDisplayRes}>
              {spriteClicked ? stageControls : ''}
            </div>

           <div className={styles.flagControlsDisplay}>
              <div>
                <Button className={styles.stageButton} onClick={onSetStageFull}>
                  <img
                    alt={props.intl.formatMessage(messages.fullStageSizeMessage)}
                    className={styles.stageButtonIcon}
                    draggable={false}
                    src={fullScreenIcon}
                    title={props.intl.formatMessage(messages.fullscreenControl)}
                  />
                </Button>
              </div>
            </div>
            <div className={styles.flagControlsDisplayRes}>
              {flagClicked ? (
                <div>
                  <Button className={styles.stageButton} onClick={onSetStageFull}>
                    <img
                      alt={props.intl.formatMessage(messages.fullStageSizeMessage)}
                      className={styles.stageButtonIcon}
                      draggable={false}
                      src={fullScreenIcon}
                      title={props.intl.formatMessage(messages.fullscreenControl)}
                    />
                  </Button>
                </div>
              ) : (
                ''
              )}
            </div>
          </div>
        </Box>
      </Box>
    )
  }

  return header
}

const mapStateToProps = (state) => ({
  // This is the button's mode, as opposed to the actual current state
  stageSizeMode: state.scratchGui.stageSize.stageSize,
  flagClicked: state.scratchGui.vmStatus.flagClicked,
  spriteClicked: state.scratchGui.vmStatus.spriteClicked,
})

StageHeaderComponent.propTypes = {
  intl: intlShape,
  isFullScreen: PropTypes.bool.isRequired,
  isPlayerOnly: PropTypes.bool.isRequired,
  onKeyPress: PropTypes.func.isRequired,
  onSetStageFull: PropTypes.func.isRequired,
  onSetStageLarge: PropTypes.func.isRequired,
  onSetStageSmall: PropTypes.func.isRequired,
  onSetStageUnFull: PropTypes.func.isRequired,
  showBranding: PropTypes.bool.isRequired,
  stageSizeMode: PropTypes.oneOf(Object.keys(STAGE_SIZE_MODES)),
  vm: PropTypes.instanceOf(VM).isRequired,
}

StageHeaderComponent.defaultProps = {
  stageSizeMode: STAGE_SIZE_MODES.large,
}

export default injectIntl(connect(mapStateToProps)(StageHeaderComponent))
