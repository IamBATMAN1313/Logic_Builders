import React, { useState, useEffect } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import '../styles/QAManagement.css';

const QAManagement = () => {
  const { showSuccess, showError } = useNotification();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [editingAnswer, setEditingAnswer] = useState(null);
  const [editAnswer, setEditAnswer] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, [filter]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/qa/admin/pending?status=${filter}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch questions');
      
      const data = await response.json();
      setQuestions(data);
    } catch (err) {
      setError('Failed to load questions');
      console.error('Error fetching questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSubmit = async (questionId) => {
    try {
      const response = await fetch(`/api/qa/admin/answer/${questionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          answer_text: answer,
          is_published: false,
          send_to_customer: true
        })
      });

      if (!response.ok) throw new Error('Failed to submit answer');

      // Update question status to "answered" after providing answer
      await updateQuestionStatus(questionId, 'answered');
      
      setAnswer('');
      setSelectedQuestion(null);
      fetchQuestions();
      showSuccess('Answer submitted successfully!');
    } catch (err) {
      showError('Failed to submit answer');
      console.error('Error submitting answer:', err);
    }
  };

  const updateQuestionStatus = async (questionId, status) => {
    try {
      const response = await fetch(`/api/qa/admin/question/${questionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) throw new Error('Failed to update status');

      fetchQuestions();
      showSuccess('Question status updated successfully');
    } catch (err) {
      showError('Failed to update question status');
      console.error('Error updating status:', err);
    }
  };

  const handleEditAnswer = async (answerId) => {
    try {
      const response = await fetch(`/api/qa/admin/answer/${answerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          answer_text: editAnswer
        })
      });

      if (!response.ok) throw new Error('Failed to update answer');

      setEditAnswer('');
      setEditingAnswer(null);
      fetchQuestions();
      showSuccess('Answer updated successfully!');
    } catch (err) {
      showError('Failed to update answer');
      console.error('Error updating answer:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published': return '#38a169';
      case 'answered': return '#3182ce';
      case 'pending': return '#d69e2e';
      case 'archived': return '#718096';
      default: return '#718096';
    }
  };

  if (loading) return <div className="loading">Loading questions...</div>;

  return (
    <div className="qa-management">
      <div className="qa-header">
        <h1>Q&A Management</h1>
        <div className="filter-controls">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Questions</option>
            <option value="pending">Pending</option>
            <option value="answered">Answered</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="questions-list">
        {questions.length === 0 ? (
          <div className="no-questions">No questions found</div>
        ) : (
          questions.map(question => (
            <div key={question.question_id} className="question-card">
              <div className="question-header">
                <div className="question-meta">
                  <span className="customer-name">{question.customer_name}</span>
                  <span className="product-name">{question.product_name}</span>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(question.status) }}
                  >
                    {question.status}
                  </span>
                </div>
                <div className="question-date">
                  {new Date(question.time_asked).toLocaleDateString()}
                </div>
              </div>

              <div className="question-content">
                <p><strong>Question:</strong> {question.question_text}</p>
                <p><strong>Category:</strong> {question.category}</p>
              </div>

              {question.answer_text && (
                <div className="answer-content">
                  {editingAnswer === question.answer_id ? (
                    <div className="edit-answer-form">
                      <p><strong>Editing Answer:</strong></p>
                      <textarea
                        value={editAnswer}
                        onChange={(e) => setEditAnswer(e.target.value)}
                        rows={4}
                        className="answer-textarea"
                      />
                      <div className="edit-actions">
                        <button 
                          className="save-btn"
                          onClick={() => handleEditAnswer(question.answer_id)}
                          disabled={!editAnswer.trim()}
                        >
                          Save Changes
                        </button>
                        <button 
                          className="cancel-btn"
                          onClick={() => {
                            setEditingAnswer(null);
                            setEditAnswer('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p><strong>Answer:</strong> {question.answer_text}</p>
                      <p><strong>Answered by:</strong> {question.answered_by}</p>
                      <p><strong>Answered on:</strong> {new Date(question.time_answered).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="question-actions">
                {!question.answer_text ? (
                  <button 
                    className="answer-btn"
                    onClick={() => setSelectedQuestion(question.question_id)}
                  >
                    Answer Question
                  </button>
                ) : (
                  <button 
                    className="answer-btn"
                    onClick={() => {
                      setEditingAnswer(question.answer_id);
                      setEditAnswer(question.answer_text);
                    }}
                    disabled={editingAnswer === question.answer_id}
                  >
                    Edit Answer
                  </button>
                )}
                
                {question.answer_text && (
                  <select
                    value={question.status}
                    onChange={(e) => updateQuestionStatus(question.question_id, e.target.value)}
                    className="status-select"
                  >
                    <option value="answered">Answered</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedQuestion && (
        <div className="answer-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Answer Question</h3>
              <button 
                className="close-btn"
                onClick={() => setSelectedQuestion(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Enter your answer..."
                rows={6}
                className="answer-textarea"
              />
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => setSelectedQuestion(null)}
              >
                Cancel
              </button>
              <button 
                className="submit-btn"
                onClick={() => handleAnswerSubmit(selectedQuestion)}
                disabled={!answer.trim()}
              >
                Submit Answer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QAManagement;
