import './App.scss';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import GaussianVisualizerPage from './features/gaussian-visualizer';
import LandingPage from './features/landing/LandingPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<LandingPage />} />
        <Route
          path='gaussian-visualizer'
          element={<GaussianVisualizerPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
