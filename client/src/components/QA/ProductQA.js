import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import '../css/ProductQA.css';

export default function ProductQA() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [qa, setQa] = useState([]);
  const [myQuestions, setMyQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState('published');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAskForm, setShowAskForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    category: 'general'
  });

  useEffect(() => {
    fetchData();
  }, [productId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [qaResponse, myQuestionsResponse] = await Promise.all([
        api.get(`/qa/product/${productId}`),
        api.get('/qa/my-questions')
      ]);
      
      setQa(qaResponse.data);
      // Filter my questions for this product
      setMyQuestions(myQuestionsResponse.data.filter(q => q.product_id == productId));
    } catch (err) {
      setError('Failed to fetch Q&A data');
      console.error('Q&A fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const submitQuestion = async () => {
    try {
      if (!newQuestion.question_text.trim()) {
        alert('Please enter your question');
        return;
      }

      await api.post(`/qa/product/${productId}/ask`, newQuestion);
      
      // Reset form
      setNewQuestion({
        question_text: '',
        category: 'general'
      });
      setShowAskForm(false);
      
      // Refresh data
      await fetchData();
      
      alert('Question submitted successfully! You will be notified when it is answered.');
    } catch (err) {
      console.error('Error submitting question:', err);
      alert(err.response?.data?.error || 'Failed to submit question');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#e53e3e';
      case 'high': return '#dd6b20';
      case 'normal': return '#38a169';
      case 'low': return '#718096';
      default: return '#38a169';
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

  if (loading) return <div className="loading">Loading Q&A...</div>;

  return (
    <div className="product-qa-page">
      <div className="qa-header">
        <h2>Product Questions & Answers</h2>
        <button 
          className="ask-question-btn"
          onClick={() => setShowAskForm(true)}
        >
          Ask a Question
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showAskForm && (
        <div className="ask-question-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Ask a Question</h3>
              <button 
                className="close-btn"
                onClick={() => setShowAskForm(false)}
              >
                ×
              </button>
            </div>
            
            <div className="question-form">
              <div className="form-group">
                <label>Your Question</label>
                <textarea
                  value={newQuestion.question_text}
                  onChange={(e) => setNewQuestion({
                    ...newQuestion,
                    question_text: e.target.value
                  })}
                  placeholder="What would you like to know about this product?"
                  rows={4}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={newQuestion.category}
                    onChange={(e) => setNewQuestion({
                      ...newQuestion,
                      category: e.target.value
                    })}
                  >
                    <option value="general">General</option>
                    <option value="specifications">Specifications</option>
                    <option value="compatibility">Compatibility</option>
                    <option value="warranty">Warranty</option>
                    <option value="shipping">Shipping</option>
                    <option value="usage">Usage Instructions</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  className="submit-btn"
                  onClick={submitQuestion}
                >
                  Submit Question
                </button>
                <button 
                  className="cancel-btn"
                  onClick={() => setShowAskForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="qa-tabs">
        <button 
          className={`tab ${activeTab === 'published' ? 'active' : ''}`}
          onClick={() => setActiveTab('published')}
        >
          Published Q&A ({qa.length})
        </button>
        <button 
          className={`tab ${activeTab === 'my-questions' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-questions')}
        >
          My Questions ({myQuestions.length})
        </button>
      </div>

      {activeTab === 'published' && (
        <div className="published-qa-section">
          {qa.length === 0 ? (
            <div className="no-qa">
              <div className="no-qa-content">
                <span className="no-qa-icon">❓</span>
                <h3>No questions yet</h3>
                <p>Be the first to ask a question about this product!</p>
                <button 
                  className="ask-first-btn"
                  onClick={() => setShowAskForm(true)}
                >
                  Ask the First Question
                </button>
              </div>
            </div>
          ) : (
            <div className="qa-list">
              {qa.map((item) => (
                <div key={item.question_id} className="qa-item">
                  <div className="question-section">
                    <div className="question-header">
                      <span className="question-label">Q:</span>
                      <span className="question-date">
                        Asked on {formatDate(item.time_asked)}
                      </span>
                    </div>
                    <div className="question-text">
                      {item.question_text}
                    </div>
                  </div>
                  
                  <div className="answer-section">
                    <div className="answer-header">
                      <span className="answer-label">A:</span>
                      <div className="answer-meta">
                        <span className="answered-by">
                          Answered by {item.answered_by_name}
                        </span>
                        <span className="answer-date">
                          on {formatDate(item.time_answered)}
                        </span>
                      </div>
                    </div>
                    <div className="answer-text">
                      {item.answer_text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'my-questions' && (
        <div className="my-questions-section">
          {myQuestions.length === 0 ? (
            <div className="no-questions">
              <div className="no-questions-content">
                <span className="no-questions-icon">🤔</span>
                <h3>No questions asked yet</h3>
                <p>Ask questions about products to get expert answers from our team.</p>
                <button 
                  className="ask-question-btn"
                  onClick={() => setShowAskForm(true)}
                >
                  Ask a Question
                </button>
              </div>
            </div>
          ) : (
            <div className="my-questions-list">
              {myQuestions.map((question) => (
                <div key={question.question_id} className="my-question-item">
                  <div className="question-header">
                    <div className="question-meta">
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(question.priority) }}
                      >
                        {question.priority}
                      </span>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(question.status) }}
                      >
                        {question.status}
                      </span>
                      <span className="category-badge">
                        {question.category}
                      </span>
                    </div>
                    <span className="question-date">
                      {formatDate(question.time_asked)}
                    </span>
                  </div>
                  
                  <div className="question-content">
                    <div className="question-text">
                      <strong>Q:</strong> {question.question_text}
                    </div>
                    
                    {question.answer_text && (
                      <div className="answer-section">
                        <div className="answer-header">
                          <strong>A:</strong>
                          <span className="answered-by">
                            {question.answered_by} • {formatDate(question.time_answered)}
                          </span>
                        </div>
                        <div className="answer-text">
                          {question.answer_text}
                        </div>
                        {question.is_published && (
                          <div className="published-indicator">
                            ✅ Published publicly
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!question.answer_text && (
                      <div className="pending-answer">
                        <span className="pending-icon">⏳</span>
                        <span>Waiting for answer...</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
