import React from 'react'
import PropTypes from 'prop-types'
import bindAll from 'lodash.bindall'
import BackpackComponent from '../components/backpack/backpack.jsx'
import {
  getBackpackContents,
  saveBackpackObject,
  deleteBackpackObject,
  soundPayload,
  costumePayload,
  spritePayload,
  codePayload,
} from '../lib/backpack-api-local'
import DragConstants from '../lib/drag-constants'
import DropAreaHOC from '../lib/drop-area-hoc.jsx'

import { connect } from 'react-redux'
import storage from '../lib/storage'
import VM from 'scratch-vm'

const dragTypes = [DragConstants.COSTUME, DragConstants.SOUND, DragConstants.SPRITE]
const DroppableBackpack = DropAreaHOC(dragTypes)(BackpackComponent)

class BackpackLocal extends React.Component {
  constructor(props) {
    super(props)
    bindAll(this, [
      'handleDrop',
      'handleToggle',
      'handleDelete',
      'getBackpackAssetURL',
      'getContents',
      'handleMouseEnter',
      'handleMouseLeave',
      'handleBlockDragEnd',
      'handleBlockDragUpdate',
      'handleMore',
    ])
    this.state = {
      // While the DroppableHOC manages drop interactions for asset tiles,
      // we still need to micromanage drops coming from the block workspace.
      blockDragOutsideWorkspace: false,
      blockDragOverBackpack: false,
      error: false,
      itemsPerPage: 20,
      moreToLoad: false,
      loading: false,
      expanded: false,
      contents: [],
    }

    // Add a web source for backpack assets stored as data URIs
    // This allows the storage module to load assets from the backpack
    if (!storage._hasAddedBackpackSource) {
      storage.addWebSource(
        [storage.AssetType.ImageVector, storage.AssetType.ImageBitmap, storage.AssetType.Sound],
        this.getBackpackAssetURL,
      )
      storage._hasAddedBackpackSource = true
    }
  }
  componentDidMount() {
    this.props.vm.addListener('BLOCK_DRAG_END', this.handleBlockDragEnd)
    this.props.vm.addListener('BLOCK_DRAG_UPDATE', this.handleBlockDragUpdate)
  }
  componentWillUnmount() {
    this.props.vm.removeListener('BLOCK_DRAG_END', this.handleBlockDragEnd)
    this.props.vm.removeListener('BLOCK_DRAG_UPDATE', this.handleBlockDragUpdate)
  }
  getBackpackAssetURL(asset) {
    // For local storage, assets are stored as data URIs
    // This is a fallback - typically assets are loaded directly from the bodyUrl
    return `data:${asset.assetType};base64,${asset.assetId}`
  }
  handleToggle() {
    const newState = !this.state.expanded
    this.setState({ expanded: newState, contents: [] }, () => {
      // Emit resize on window to get blocks to resize
      window.dispatchEvent(new Event('resize'))
    })
    if (newState) {
      this.getContents()
    }
  }
  handleDrop(dragInfo) {
    let payloader = null
    let presaveAsset = null
    switch (dragInfo.dragType) {
      case DragConstants.COSTUME:
        payloader = costumePayload
        presaveAsset = dragInfo.payload.asset
        break
      case DragConstants.SOUND:
        payloader = soundPayload
        presaveAsset = dragInfo.payload.asset
        break
      case DragConstants.SPRITE:
        payloader = spritePayload
        break
      case DragConstants.CODE:
        payloader = codePayload
        break
    }
    if (!payloader) return

    // Creating the payload is async, so set loading before starting
    this.setState({ loading: true }, () => {
      payloader(dragInfo.payload, this.props.vm)
        .then((payload) => {
          // Force the asset to save to the asset server before storing in backpack
          // Ensures any asset present in the backpack is also on the asset server
          if (presaveAsset && !presaveAsset.clean) {
            return storage
              .store(
                presaveAsset.assetType,
                presaveAsset.dataFormat,
                presaveAsset.data,
                presaveAsset.assetId,
              )
              .then(() => payload)
          }
          return payload
        })
        .then((payload) =>
          // Save to localStorage - no host, token, or username needed
          saveBackpackObject(payload),
        )
        .then((item) => {
          this.setState({
            loading: false,
            contents: [item].concat(this.state.contents),
          })
        })
        .catch((error) => {
          this.setState({ error: true, loading: false })
          console.error('Error saving to backpack:', error)
          // Show user-friendly error message
          if (error.message && error.message.includes('quota')) {
            alert('Backpack is full! Please delete some items to make space.')
          }
        })
    })
  }
  handleDelete(id) {
    this.setState({ loading: true }, () => {
      deleteBackpackObject({ id })
        .then(() => {
          this.setState({
            loading: false,
            contents: this.state.contents.filter((o) => o.id !== id),
          })
        })
        .catch((error) => {
          this.setState({ error: true, loading: false })
          console.error('Error deleting from backpack:', error)
        })
    })
  }
  getContents() {
    // localStorage version doesn't need authentication
    this.setState({ loading: true, error: false }, () => {
      getBackpackContents({
        offset: this.state.contents.length,
        limit: this.state.itemsPerPage,
      })
        .then((contents) => {
          this.setState({
            contents: this.state.contents.concat(contents),
            moreToLoad: contents.length === this.state.itemsPerPage,
            loading: false,
          })
        })
        .catch((error) => {
          this.setState({ error: true, loading: false })
          console.error('Error loading backpack contents:', error)
        })
    })
  }
  handleBlockDragUpdate(isOutsideWorkspace) {
    this.setState({
      blockDragOutsideWorkspace: isOutsideWorkspace,
    })
  }
  handleMouseEnter() {
    if (this.state.blockDragOutsideWorkspace) {
      this.setState({
        blockDragOverBackpack: true,
      })
    }
  }
  handleMouseLeave() {
    this.setState({
      blockDragOverBackpack: false,
    })
  }
  handleBlockDragEnd(blocks, topBlockId) {
    if (this.state.blockDragOverBackpack) {
      this.handleDrop({
        dragType: DragConstants.CODE,
        payload: {
          blockObjects: blocks,
          topBlockId: topBlockId,
        },
      })
    }
    this.setState({
      blockDragOverBackpack: false,
      blockDragOutsideWorkspace: false,
    })
  }
  handleMore() {
    this.getContents()
  }
  render() {
    return (
      <DroppableBackpack
        blockDragOver={this.state.blockDragOverBackpack}
        contents={this.state.contents}
        error={this.state.error}
        expanded={this.state.expanded}
        loading={this.state.loading}
        showMore={this.state.moreToLoad}
        onDelete={this.handleDelete}
        onDrop={this.handleDrop}
        onMore={this.handleMore}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
        onToggle={this.handleToggle}
      />
    )
  }
}

BackpackLocal.propTypes = {
  vm: PropTypes.instanceOf(VM),
}

const mapStateToProps = (state) => ({
  dragInfo: state.scratchGui.assetDrag,
  vm: state.scratchGui.vm,
  blockDrag: state.scratchGui.blockDrag,
})

const mapDispatchToProps = () => ({})

export default connect(mapStateToProps, mapDispatchToProps)(BackpackLocal)
