'use client';
import { motion } from 'framer-motion';

export interface StoryItem {
  id: string;
  mediaUrl: string;
  mediaType: string;
  createdAt: number;
  viewed: boolean;
}

export interface StoryGroup {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  items: StoryItem[];
  allViewed: boolean;
}

interface StoriesBarProps {
  stories: StoryGroup[];
  onViewStory: (storyId: string) => void;
  onOpenViewer: (userId: string) => void;
  onCreateStory: () => void;
}

export function StoriesBar({ stories, onViewStory, onOpenViewer, onCreateStory }: StoriesBarProps) {
  if (stories.length === 0) return null;

  return (
    <div className="flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,.1)', background: 'rgba(0,20,40,.4)' }}>
      <div className="flex items-center gap-3 px-3 py-2.5 overflow-x-auto scrollbar-hide">
        {/* Create story button */}
        <button
          onClick={onCreateStory}
          className="flex-shrink-0 relative group"
          title="Crear historia"
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all duration-200 overflow-hidden"
            style={{
              background: 'rgba(0,0,0,.3)',
              border: '2px dashed rgba(109,213,250,.5)',
              color: '#6dd5fa',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6dd5fa'; e.currentTarget.style.boxShadow = '0 0 12px rgba(100,180,255,.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(109,213,250,.5)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            +
          </div>
          <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] whitespace-nowrap font-medium"
            style={{ color: 'rgba(255,255,255,.6)' }}>
            Tu historia
          </span>
        </button>

        {/* User stories */}
        {stories.map((group) => (
          <button
            key={group.userId}
            onClick={() => onOpenViewer(group.userId)}
            className="flex-shrink-0 relative group"
            title={`${group.displayName || group.username} - ${group.items.length} historia${group.items.length > 1 ? 's' : ''}`}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-14 h-14 rounded-full p-[2.5px]"
              style={{
                background: group.allViewed
                  ? 'rgba(255,255,255,.2)'
                  : 'linear-gradient(135deg, #6dd5fa 0%, #2980b9 50%, #7fffff 100%)',
                boxShadow: group.allViewed ? 'none' : '0 0 12px rgba(100,180,255,.3)',
              }}
            >
              <div className="w-full h-full rounded-full p-[2px] overflow-hidden" style={{ background: 'rgba(10,37,64,.95)' }}>
                {group.avatarUrl ? (
                  <img
                    src={group.avatarUrl}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ background: 'rgba(109,213,250,.2)', color: '#6dd5fa' }}>
                    {(group.displayName || group.username).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </motion.div>
            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] whitespace-nowrap max-w-[60px] truncate font-medium"
              style={{ color: 'rgba(255,255,255,.6)' }}>
              {group.displayName || group.username}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}