import bindAll from 'lodash.bindall'
import PropTypes from 'prop-types'
import React from 'react'
import { connect } from 'react-redux'
import { projectTitleInitialState } from '../reducers/project-title'
import downloadBlob from '../lib/download-blob'
import localforage from 'localforage'
import { setIsSavingState, setIsScratchData, setIsSavingStateStatus, setIsPendingState, setProjectName, addNotification, pushProjectHistory, setMyProjectsGetPending } from './../reducers/vm-status.js'
import { validateProjectFromBase64 } from '../lib/project-validator'
/**
 * Project saver component passes a downloadProject function to its child.
 * It expects this child to be a function with the signature
 *     function (downloadProject, props) {}
 * The component can then be used to attach project saving functionality
 * to any other component:
 *
 * <SB3Downloader>{(downloadProject, props) => (
 *     <MyCoolComponent
 *         onClick={downloadProject}
 *         {...props}
 *     />
 * )}</SB3Downloader>
 */
class SB3Downloader extends React.Component {
  constructor(props) {
    super(props)
    this.abortController = null
    this.debounceTimeout = null
    this.previousBase64 = null
    this.pageLoadTime = Date.now() // Track when component mounted to prevent early saves
    bindAll(this, ['downloadProject', 'downloadLocalStorageProject', 'setInitialBase64'])
  }
  
  // Method to pre-initialize previousBase64 with fetched data
  // This prevents the first auto-save from triggering with the same data
  setInitialBase64(base64Data) {
    if (base64Data && !this.previousBase64) {
      this.previousBase64 = base64Data;
    }
  }
  downloadProject() {
    this.props.saveProjectSb3().then((content) => {
      if (this.props.onSaveFinished) {
        this.props.onSaveFinished()
      }
      downloadBlob(this.props.projectFilename, content)
    })
  }
  downloadLocalStorageProject = async () => {
    const url = new URLSearchParams(window.location.search)

    const projectId = url.get('projectid')
    const inputLayout = url.get('inputLayout')
    const fetchapiurl = url.get('fetchapiurl');

    if (inputLayout === 'myprojects') {
      // Layer 1: Check if initial project fetch is still pending
      if (this.props.isMyProjectsGetPending) {
        return;
      }
      
      // Layer 2: Check if this is the first load
      if (this.props.isFirst) {
        console.log('[Save Guard] Blocking save - first load not complete');
        return
      }
      
      // Layer 3: Time-based protection - reject saves within first 15 seconds of page load
      const timeSincePageLoad = Date.now() - this.pageLoadTime;
      if (timeSincePageLoad < 15000) {
        return;
      }
      
      if (String(this.props.isEditableProject) === 'false' && !this.props.isCloned) {
        return
      }
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout)
      }
      this.props.setIsPendingState(true)
      this.debounceTimeout = setTimeout(async () => {
        if (this.abortController) {
          this.abortController.abort()
        }

        this.abortController = new AbortController()
        const signal = this.abortController?.signal
        this.props.saveProjectSb3().then((content) => {

          if (this.props.onSaveFinished) {
            this.props.onSaveFinished()
          }

          const reader = new FileReader()
          
          reader.onloadend = async () => {
            const buffer = reader.result
            // const binaryString = Array.prototype.map
            //   .call(new Uint8Array(buffer), (x) => String.fromCharCode(x))
            //   .join('')
            let base64blocks = btoa(
              new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
            )

            // Layer 4: Check if data is identical to previous save (duplicate prevention)
            if (this.previousBase64 === base64blocks) {
              return
            }

            // Layer 5: Size validation - reject suspiciously small projects (< 200 bytes likely empty)
            if (typeof base64blocks === 'string') {
              const base64Size = (base64blocks.length * 3) / 4 - (base64blocks.endsWith('==') ? 2 : base64blocks.endsWith('=') ? 1 : 0);
              
              // Check minimum size to prevent saving empty/default projects
              if (base64Size < 200) {
                console.error('[Save Guard] Blocking save - project too small (likely empty):', base64Size, 'bytes');
                this.props.setIsPendingState(false);
                this.props.addNotification({
                  type: 'error',
                  icon: 'error',
                  message: 'Cannot save: Project data appears to be empty or corrupted.',
                  duration: 5000
                });
                return;
              }
              
              // Check maximum size limit
              if (base64Size > 10 * 1024 * 1024) {
                this.props.setIsPendingState(false)
                this.props.addNotification({
                  type: 'error',
                  icon: 'error',
                  message: 'Unable to save. The project exceeds the size limit. Please reduce file quality or remove large files.',
                  duration: 10000
                });
                return 
              }
            }
            
            // Update previousBase64 after all validations pass
            this.previousBase64 = base64blocks

            const structure = {
              name: this.props.projectName,
              projectType: 'scratch',
              content: base64blocks,
            }

            const structureString = JSON.stringify(structure)

            const apiUrl = `${fetchapiurl}/projects/${projectId}`
      
            try {
              if(!projectId) {
                this.props.setIsPendingState(false)
                return
              }
              this.props.setIsSavingState(true)
              this.props.addNotification({
                type: 'saving',
                icon: 'saving',
                message: 'Saving project… Please wait.',
              });
              
              const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: structureString,
                credentials: 'include',
                signal,
              })

               this.props.pushProjectHistory(base64blocks)
              
              if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`HTTP ${response.status}: ${errorText || 'Unknown error'}`)
              }

              if (this.previousBase64 !== base64blocks) {
                this.previousBase64 = base64blocks
               } 
              
              this.props.addNotification({
                type: 'success',
                icon: 'success',
                message: 'Project saved successfully',
                duration: 3000
              });
              this.props.setIsPendingState(false)
            } catch (error) {
              this.props.setIsPendingState(false)
              
              let errorMessage = 'Failed to save project'
              if (error.name === 'AbortError') {
                errorMessage = 'Save operation was cancelled'
              } else if (error.message.includes('network')) {
                errorMessage = 'Network error: Check your connection'
              } else if (error.message.includes('400')) {
                errorMessage = 'Invalid project data'
              } else if (error.message.includes('401')) {
                errorMessage = 'Authentication required'
              } else if (error.message.includes('403')) {
                errorMessage = 'Permission denied'
              } else if (error.message.includes('413')) {
                errorMessage = 'Project too large'
              } else if (error.message.includes('500')) {
                errorMessage = 'Server error: Please try again later'
              } else if (error.message) {
                errorMessage = `Save failed: ${error.message}`
              }
              
              this.props.addNotification({
                type: 'error',
                icon: 'error',
                message: errorMessage,
                duration: 10000
              });
            } finally {
              this.props.setIsSavingState(false)
              setTimeout(() => {
                this.props.setIsSavingStateStatus('')
              }, 2000)
            }
          }
          reader.readAsArrayBuffer(content)
        })
      }, 5000)
    } else {
      this.props.saveProjectSb3().then((content) => {
        if (this.props.onSaveFinished) {
          this.props.onSaveFinished()
        }
        const reader = new FileReader()
        reader.onloadend = async () => {
          const buffer = reader.result
          const binaryString = Array.prototype.map
            .call(new Uint8Array(buffer), (x) => String.fromCharCode(x))
            .join('')
          let base64blocks = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
          )
          this.props.setIsScratchData(base64blocks)
          setTimeout(() => {
            this.props.saveProjectSb3().then((freshContent) => {
              const freshReader = new FileReader()
              freshReader.onloadend = async () => {
                const freshBuffer = freshReader.result
                let freshBase64blocks = btoa(
                  new Uint8Array(freshBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
                )
                this.props.setIsScratchData(freshBase64blocks)
              }
              freshReader.readAsArrayBuffer(freshContent)
            })
          }, 50)
        }
        reader.readAsArrayBuffer(content)
      })
    }
  }

  render() {
    const { children } = this.props
    return children(
      this.props.className,
      this.downloadProject,
      this.downloadLocalStorageProject,
      this.setInitialBase64  // Expose method to pre-initialize previousBase64
    )
  }
}

const getProjectFilename = (curTitle, defaultTitle) => {
  let filenameTitle = curTitle
  if (!filenameTitle || filenameTitle.length === 0) {
    filenameTitle = defaultTitle
  }
  return `${filenameTitle.substring(0, 100)}.sb3`
}

SB3Downloader.propTypes = {
  children: PropTypes.func,
  className: PropTypes.string,
  onSaveFinished: PropTypes.func,
  projectFilename: PropTypes.string,
  saveProjectSb3: PropTypes.func,
}
SB3Downloader.defaultProps = {
  className: '',
}

const mapStateToProps = (state) => ({
  saveProjectSb3: state.scratchGui.vm.saveProjectSb3.bind(state.scratchGui.vm),
  isFirst: state.scratchGui.vmStatus.isFirst,
  projectFilename: getProjectFilename(state.scratchGui.projectTitle, projectTitleInitialState),
  projectName: state.scratchGui.vmStatus.projectName,
  isEditableProject: state.scratchGui.vmStatus.isEditableProject,
  isCloned: state.scratchGui.vmStatus.isCloned,
  isMyProjectsGetPending: state.scratchGui.vmStatus.isMyProjectsGetPending,
})

const mapDispatchToProps = {
  setIsSavingState,
  setIsScratchData,
  setIsSavingStateStatus,
  setIsPendingState,
  setProjectName,
  addNotification,
  pushProjectHistory,
  setMyProjectsGetPending,
}

export default connect(mapStateToProps, mapDispatchToProps)(SB3Downloader)
