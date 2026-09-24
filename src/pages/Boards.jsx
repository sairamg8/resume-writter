import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Columns2 } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { BoardStorageNotice } from '@/components/board/BoardStorageNotice';

/**
 * The board grid — every board (a v2 project: columns and issues) as a card, plus create and
 * delete. Opens a board at /boards/:id.
 */
export function Boards() {
  const navigate = useNavigate();
  const { boards, persistError, recovery, dismissRecovery, addBoard, deleteBoard } = useBoardStore();

  function create() {
    const board = addBoard();
    navigate(`/boards/${board.id}`);
  }

  function confirmDelete(e, b) {
    e.stopPropagation();
    if (confirm(`Delete "${b.title || 'this board'}"?`)) deleteBoard(b.id);
  }

  return (
    <div className="min-h-screen bg-[#f5f3ef]">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate('/')} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Back to dashboard">
              <ArrowLeft size={16} />
            </button>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Columns2 size={16} className="text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Boards</span>
          </div>
          <button onClick={create} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus size={13} /> New board
          </button>
        </div>
      </div>

      <BoardStorageNotice persistError={persistError} recovery={recovery} onDismissRecovery={dismissRecovery} className="max-w-7xl mx-auto px-4 sm:px-6 pt-3" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {boards.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Columns2 size={26} className="text-indigo-300" />
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">No boards yet</p>
            <p className="text-xs text-gray-400 mb-4">Create a board to organise tasks into lists and cards.</p>
            <button onClick={create} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus size={14} /> Create board
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((b) => {
              const cardCount = b.issues.length;
              return (
                <div
                  key={b.id}
                  onClick={() => navigate(`/boards/${b.id}`)}
                  className="group cursor-pointer bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                    <span className="flex-1 text-sm font-semibold text-gray-900 truncate">{b.title || 'Untitled board'}</span>
                    <button
                      onClick={(e) => confirmDelete(e, b)}
                      className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 no-hover:opacity-100 transition-all shrink-0"
                      title="Delete board"
                      aria-label="Delete board"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {b.columns.length} list{b.columns.length !== 1 ? 's' : ''} · {cardCount} card{cardCount !== 1 ? 's' : ''}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
