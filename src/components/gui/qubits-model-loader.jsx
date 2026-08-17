import PropTypes from 'prop-types'
import React, { useEffect, useRef, useState } from 'react'
import VM from 'scratch-vm'

import styles from './gui.css'

import Loader from './icon--loader.svg'

/**
 * Event emitted by the teachable machine extension while the project's model
 * URL is being resolved. Payload: {loading: boolean, error: ?string}
 */
const QUBITS_MODEL_LOADING = 'QUBITS_MODEL_LOADING'

/**
 * Shows the loader while the VM resolves a project's model URL. Several "use
 * model" blocks can resolve at once, so in-flight loads are counted rather than
 * stored as a boolean — the loader stays up until the last one finishes.
 */
const QubitsModelLoader = ({ vm }) => {
  const [pending, setPending] = useState(0)
  const pendingRef = useRef(0)

  useEffect(() => {
    const runtime = vm && vm.runtime
    if (!runtime) return

    const handleLoading = ({ loading, error }) => {
      pendingRef.current = Math.max(0, pendingRef.current + (loading ? 1 : -1))
      setPending(pendingRef.current)
      if (error) {
        // eslint-disable-next-line no-console
        console.warn(`Could not resolve project model URL: ${error}`)
      }
    }

    runtime.on(QUBITS_MODEL_LOADING, handleLoading)
    return () => {
      runtime.removeListener(QUBITS_MODEL_LOADING, handleLoading)
      pendingRef.current = 0
    }
  }, [vm])

  return pending > 0 ? (
    <div className={styles.modelLoaderContainer}>
    <div className={styles.modelLoader}>
      <img draggable={false} src={Loader} />
    </div>
    </div>
  ) : null
}

QubitsModelLoader.propTypes = {
  vm: PropTypes.instanceOf(VM).isRequired,
}

export default QubitsModelLoader
