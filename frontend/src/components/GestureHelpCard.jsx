export default function GestureHelpCard({ canvasMode, styles = {} }) {
  return (
    <div className="glass-panel" style={styles.helpCard}>
      {canvasMode === '3d' ? (
        <>
          <h4 style={styles.helpTitle}>How to Build 3D Models in the Air:</h4>
          <ul style={styles.helpList}>
            <li>Ensure you are in a well-lit area.</li>
            <li><strong>Orbit View Tool</strong>:
              <ul style={{ paddingLeft: '14px', listStyleType: 'circle', display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px' }}>
                <li><strong>Rotate View</strong>: Raise both <strong>index & middle fingers</strong> (Hover) and move them left/right/up/down to orbit the camera!</li>
                <li><strong>Zoom Camera</strong>: Raise <strong>index finger & thumb</strong> (Pinch) and spread them apart or pinch together to zoom in or out!</li>
              </ul>
            </li>
            <li><strong>3D Primitive Shapes (Cube, Sphere, Cylinder, Pyramid, Cone)</strong>:
              <ul style={{ paddingLeft: '14px', listStyleType: 'circle', display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px' }}>
                <li><strong>Hover/Move Shape</strong>: Raise <strong>index & middle fingers</strong> to move the active shape preview in 3D space!</li>
                <li><strong>Resize Shape</strong>: Raise <strong>index finger & thumb</strong> and move them apart/together to adjust the shape's size.</li>
                <li><strong>Lock Shape Size</strong>: Tuck your <strong>thumb</strong> back (only index up) to lock the shape's size. Move your finger to position the shape.</li>
                <li><strong>Stamp Shape into Scene</strong>: Close all your fingers (make a <strong>fist</strong>) to stamp the shape onto the wireframe canvas!</li>
              </ul>
            </li>
            <li><strong>3D Freehand Sketching Tool</strong>:
              <ul style={{ paddingLeft: '14px', listStyleType: 'circle', display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px' }}>
                <li><strong>Draw 3D Stroke</strong>: Raise only your <strong>index finger</strong> and draw in thin air to create beautiful 3D wireframe sketches!</li>
                <li><strong>Lift Finger</strong>: Raise both <strong>index & middle fingers</strong> or close your fist to stop drawing.</li>
              </ul>
            </li>
            <li><strong>Clear Viewport</strong>: Select <strong>Eraser</strong> or press <strong>Clear</strong>. You can also wave your hand left & right to wipe the 3D scene!</li>
            <li>You can also drag with your mouse to orbit/sketch, and use the scroll wheel to zoom!</li>
          </ul>
        </>
      ) : (
        <>
          <h4 style={styles.helpTitle}>How to Draw in the Air:</h4>
          <ul style={styles.helpList}>
            <li>Ensure you are in a well-lit area.</li>
            <li><strong>Draw Gesture</strong>: Raise only your <strong>index finger</strong>. A line will trail your finger tip (works for Paint Brush, Sharp Pencil, Highlighter, Spray Can, and Eraser).</li>
            <li><strong>Hover Pointer Gesture</strong>: Raise both your <strong>index & middle fingers</strong> (like a 'V' peace sign) to move the pointer without drawing.</li>
            <li><strong>Eraser Wave Gesture</strong>: Select the <strong>Eraser</strong> tool and wave your hand rapidly left and right to clear the canvas paint!</li>
            <li><strong>Shape Sizing Gesture</strong>: When a shape is active (e.g., Rectangle, Triangle, Heart, Cloud, Moon, Cube, etc.), raise your <strong>index finger & thumb</strong>. Move them apart/together to change the size.</li>
            <li><strong>Lock Size Gesture</strong>: Tuck your <strong>thumb</strong> back to lock the shape's size. You can move your finger around to position the shape preview.</li>
            <li><strong>Stamp Shape Gesture</strong>: Close all your fingers (make a <strong>fist</strong>) to stamp the shape onto the canvas!</li>
            <li><strong>Tools & Colors Dropdown</strong>: Use the top bar dropdowns to select from 20+ shapes, customize colors, adjust size/opacity, and toggle stabilizer.</li>
            <li>You can also click/drag on the canvas using your mouse as a fallback!</li>
          </ul>
        </>
      )}
    </div>
  )
}
