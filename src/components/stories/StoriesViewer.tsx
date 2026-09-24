'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StoryGroup } from './StoriesBar';

interface StoriesViewerProps {
  stories: StoryGroup[];
  initialUserId: string;
  onClose: () => void;
  onAllViewed: () => void;
}

const IMAGE_DURATION = 5000;

export function StoriesViewer({ stories, initialUserId, onClose, onAllViewed }: StoriesViewerProps) {
  const [userIndex, setUserIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const progressRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const viewedSet = useRef(new Set<string>());

  // Find initial user index
  useEffect(() => {
    const idx = stories.findIndex(g => g.userId === initialUserId);
    if (idx >= 0) setUserIndex(idx);
  }, [initialUserId, stories]);

  const currentGroup = stories[userIndex];
  const currentStory = currentGroup?.items[storyIndex];

  const markViewed = useCallback((storyId: string) => {
    if (!viewedSet.current.has(storyId)) {
      viewedSet.current.add(storyId);
      fetch(`/api/stories/${storyId}/view`, { method: 'POST' }).catch(() => {});
    }
  }, []);

  const advance = useCallback(() => {
    if (!currentGroup) return;
    if (storyIndex < currentGroup.items.length - 1) {
      setStoryIndex(prev => prev + 1);
      setProgress(0);
    } else if (userIndex < stories.length - 1) {
      setUserIndex(prev => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onAllViewed();
      onClose();
    }
  }, [currentGroup, storyIndex, userIndex, stories.length, onClose, onAllViewed]);

  const goBack = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(prev => prev - 1);
      setProgress(0);
    } else if (userIndex > 0) {
      setUserIndex(prev => prev - 1);
      setStoryIndex(0);
      setProgress(0);
    }
  }, [storyIndex, userIndex]);

  // Mark current story as viewed when it changes
  useEffect(() => {
    if (currentStory) {
      markViewed(currentStory.id);
    }
  }, [currentStory, markViewed]);

  // Progress timer for images
  useEffect(() => {
    if (!currentStory || paused) return;

    if (currentStory.mediaType === 'video') {
      // Video handles its own timing via onEnded
      setProgress(0);
      return;
    }

    startTimeRef.current = Date.now() - (progress / 100) * IMAGE_DURATION;

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / IMAGE_DURATION) * 100, 100);
      progressRef.current = pct;
      setProgress(pct);

      if (pct >= 100) {
        advance();
      } else {
        timerRef.current = requestAnimationFrame(tick);
      }
    };

    timerRef.current = requestAnimationFrame(tick);

    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [currentStory, paused, advance]);

  // Reset progress on story change
  useEffect(() => {
    setProgress(0);
    progressRef.current = 0;
  }, [storyIndex, userIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft') goBack();
      if (e.key === ' ') { e.preventDefault(); setPaused(p => !p); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, advance, goBack]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleVideoEnded = () => {
    advance();
  };

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) {
      goBack();
    } else {
      advance();
    }
  };

  if (!currentGroup || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[60] w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
      >
        [X]
      </button>

      {/* User info */}
      <div className="absolute top-4 left-4 z-[60] flex items-center gap-2">
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/30">
          {currentGroup.avatarUrl ? (
            <img src={currentGroup.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-amber-500/30 flex items-center justify-center text-white font-bold text-xs">
              {(currentGroup.displayName || currentGroup.username).charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <span className="text-white text-sm font-medium drop-shadow-md">
          {currentGroup.displayName || currentGroup.username}
        </span>
        <span className="text-white/60 text-xs">
          {formatTimeAgo(currentStory.createdAt)}
        </span>
      </div>

      {/* Progress bars */}
      <div className="absolute top-14 left-4 right-4 z-[60] flex gap-1">
        {currentGroup.items.map((item, i) => (
          <div key={item.id} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{
                width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%',
              }}
              transition={{ duration: 0.1, ease: 'linear' }}
            />
          </div>
        ))}
      </div>

      {/* Story content */}
      <div
        className="relative w-full h-full max-w-lg mx-auto cursor-pointer"
        onClick={handleTap}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStory.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full flex items-center justify-center"
          >
            {currentStory.mediaType === 'video' ? (
              <video
                ref={videoRef}
                src={currentStory.mediaUrl}
                autoPlay
                playsInline
                onEnded={handleVideoEnded}
                onLoadedMetadata={(e) => {
                  // Update progress bar based on video duration
                  const vid = e.target as HTMLVideoElement;
                  const updateProgress = () => {
                    if (vid.paused || vid.ended) return;
                    const pct = (vid.currentTime / vid.duration) * 100;
                    setProgress(pct);
                    requestAnimationFrame(updateProgress);
                  };
                  updateProgress();
                }}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <img
                src={currentStory.mediaUrl}
                alt=""
                className="max-w-full max-h-full object-contain"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation hints (subtle) */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-xs pointer-events-none">
        ‹
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-xs pointer-events-none">
        ›
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}