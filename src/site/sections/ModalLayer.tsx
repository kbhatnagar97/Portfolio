import { AnimatePresence } from 'framer-motion';
import type { IProject } from '../data';
import ProjectModal from './ProjectModal';

interface IModalLayerProps {
  project?: IProject;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

// its own chunk so framer-motion loads after first paint; stays mounted once opened so the exit animation plays
const ModalLayer = ({ project, onClose, onNavigate }: IModalLayerProps) => (
  <AnimatePresence>{project && <ProjectModal key='modal' project={project} onNavigate={onNavigate} onClose={onClose} />}</AnimatePresence>
);

export default ModalLayer;
