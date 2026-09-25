import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import Auth from './Auth';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

function calculateRiskScore(transaction, transactions) {
  const transactionIndex = transactions.findIndex(
    (item) => item.id === transaction.id
  );

  if (transactionIndex < 3) {
    return 0;
  }

  const previousTransactions = transactions
    .slice(0, transactionIndex)
    .filter((item) => item.type === transaction.type);

  if (previousTransactions.length < 3) {
    return 0;
  }

  // Amount deviation
  const amount = Number(transaction.amount || 0);

  const amounts = previousTransactions.map((item) => Number(item.amount || 0));

  const historicalAverage =
    amounts.reduce((sum, value) => sum + value, 0) / amounts.length;

  const amountDeviation =
    historicalAverage === 0
      ? 0
      : (Math.abs(amount - historicalAverage) / historicalAverage) * 100;

  const amountScore = Math.min(Math.round(amountDeviation), 100);

  // Category behavior
  const category = transaction.category || 'Other';

  const categoryTransactions = previousTransactions.filter(
    (item) => (item.category || 'Other') === category
  );

  let categoryScore = 0;

  if (categoryTransactions.length === 0) {
    categoryScore = 100;
  } else if (categoryTransactions.length === 1) {
    categoryScore = 60;
  } else if (categoryTransactions.length === 2) {
    categoryScore = 30;
  }

  // Transaction frequency
  const recentTransactions = previousTransactions.slice(-5);

  let frequencyScore = 0;

  if (recentTransactions.length >= 5) {
    frequencyScore = 20;
  } else if (recentTransactions.length >= 4) {
    frequencyScore = 10;
  }

  // Final risk score
  const riskScore = Math.round(
    amountScore * 0.6 + categoryScore * 0.3 + frequencyScore * 0.1
  );

  return Math.min(riskScore, 100);
}

function getRiskSignals(transaction, transactions) {
  if (!transaction || !Array.isArray(transactions)) {
    return {
      amountScore: 0,
      categoryScore: 0,
      frequencyScore: 0,
    };
  }

  const transactionIndex = transactions.findIndex(
    (item) => item.id === transaction.id
  );

  if (transactionIndex < 0) {
    return {
      amountScore: 0,
      categoryScore: 0,
      frequencyScore: 0,
    };
  }

  const previousTransactions = transactions
    .slice(0, transactionIndex)
    .filter((item) => item.type === transaction.type);

  if (previousTransactions.length < 3) {
    return {
      amountScore: 0,
      categoryScore: 0,
      frequencyScore: 0,
    };
  }

  // Amount signal
  const amount = Number(transaction.amount || 0);

  const amounts = previousTransactions.map((item) => Number(item.amount || 0));

  const historicalAverage =
    amounts.reduce((sum, value) => sum + value, 0) / amounts.length;

  const amountScore =
    historicalAverage === 0
      ? 0
      : Math.min(
          Math.round(
            (Math.abs(amount - historicalAverage) / historicalAverage) * 100
          ),
          100
        );

  // Category signal
  const category = transaction.category || 'Other';

  const categoryTransactions = previousTransactions.filter(
    (item) => (item.category || 'Other') === category
  );

  let categoryScore = 0;

  if (categoryTransactions.length === 0) {
    categoryScore = 100;
  } else if (categoryTransactions.length === 1) {
    categoryScore = 60;
  } else if (categoryTransactions.length === 2) {
    categoryScore = 30;
  }

  // Frequency signal
  const recentTransactions = previousTransactions.slice(-5);
  const frequencyScore =
    previousTransactions.length >= 5
      ? 20
      : recentTransactions.length >= 4
      ? 10
      : 0;

  return {
    amountScore,
    categoryScore,
    frequencyScore,
  };
}

function getBehaviorAnalysis(transaction, transactions) {
  const transactionIndex = transactions.findIndex(
    (item) => item.id === transaction.id
  );

  if (transactionIndex < 0) {
    return {
      average: 0,
      deviation: 0,
      previousCount: 0,
    };
  }

  const previousTransactions = transactions
    .slice(0, transactionIndex)
    .filter((item) => item.type === transaction.type);

  if (previousTransactions.length < 3) {
    return {
      average: 0,
      deviation: 0,
      previousCount: previousTransactions.length,
    };
  }

  const amounts = previousTransactions.map((item) => Number(item.amount || 0));

  const average =
    amounts.reduce((sum, value) => sum + value, 0) / amounts.length;

  const amount = Number(transaction.amount || 0);

  const deviation =
    average === 0
      ? 0
      : Math.round((Math.abs(amount - average) / average) * 100);

  return {
    average: Math.round(average),
    deviation,
    previousCount: previousTransactions.length,
  };
}

function getRiskLevel(score) {
  if (score >= 80) {
    return 'Critical';
  }

  if (score >= 60) {
    return 'High';
  }

  if (score >= 30) {
    return 'Medium';
  }

  return 'Low';
}

function getRiskSummary(transactions) {
  const totalTransactions = transactions.length;

  const highRiskTransactions = transactions.filter((transaction) => {
    const score = calculateRiskScore(transaction, transactions);
    return score >= 60;
  }).length;

  const criticalRiskTransactions = transactions.filter((transaction) => {
    const score = calculateRiskScore(transaction, transactions);
    return score >= 80;
  }).length;

  const averageRiskScore =
    totalTransactions === 0
      ? 0
      : Math.round(
          transactions.reduce(
            (total, transaction) =>
              total + calculateRiskScore(transaction, transactions),
            0
          ) / totalTransactions
        );

  return {
    totalTransactions,
    highRiskTransactions,
    criticalRiskTransactions,
    averageRiskScore,
  };
}

function getRiskDistribution(transactions) {
  const distribution = {
    Low: 0,
    Medium: 0,
    High: 0,
    Critical: 0,
  };

  transactions.forEach((transaction) => {
    const score = calculateRiskScore(transaction, transactions);
    const level = getRiskLevel(score);

    distribution[level]++;
  });

  return distribution;
}

function getRiskReasons(transaction, transactions) {
  const analysis = getBehaviorAnalysis(transaction, transactions);
  const reasons = [];

  if (analysis.previousCount < 3) {
    reasons.push(
      'Not enough historical transactions for a reliable comparison.'
    );

    return reasons;
  }

  if (analysis.deviation >= 80) {
    reasons.push(
      'Transaction amount is highly unusual compared with previous behaviour.'
    );
  } else if (analysis.deviation >= 60) {
    reasons.push(
      'Transaction amount is significantly different from previous behaviour.'
    );
  } else if (analysis.deviation >= 30) {
    reasons.push(
      'Transaction amount differs noticeably from previous behaviour.'
    );
  } else {
    reasons.push('Transaction is within Usual historic range.');
  }

  if (transaction.type === 'expense') {
    reasons.push('Comparison is based on previous expense transactions.');
  } else {
    reasons.push('Comparison is based on previous income transactions.');
  }

  return reasons;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [sortBy, setSortBy] = useState('risk');
  const [riskFilter, setRiskFilter] = useState('all');
  const [searchTerm, setSeacrhTerm] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      return;
    }

    const userDoc = doc(db, 'users', user.uid);
    const unsubscribeTransactions = onSnapshot(
      userDoc,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();

          if (Array.isArray(data.transactions)) {
            setTransactions(data.transactions);
          } else {
            setTransactions([]);
          }
        } else {
          setTransactions([]);
        }
      },
      (error) => {
        console.error('TRANSACTION READ ERROR:', error);
      }
    );

    return unsubscribeTransactions;
  }, [user]);

  if (loading) {
    return <h2>Loading... </h2>;
  }

  if (!user) {
    return <Auth />;
  }

  const riskDistribution = getRiskDistribution(transactions);
  const riskChartData = [
    { name: 'Low', count: riskDistribution.Low },
    { name: 'Medium', count: riskDistribution.Medium },
    { name: 'High', count: riskDistribution.High },
    { name: 'Critical', count: riskDistribution.Critical },
  ];

  return (
    <div className={`app ${darkMode ? 'darkMode' : ''}`}>
      <div className="dashboard">
        <header className="dashboardHeader">
          <div>
            <h1>Fraud Detection Dashboard</h1>
            <p>Monitor and Investigate Suspicious Transactions.</p>
          </div>

          <div className="headerActions">
            <button
              type="button"
              className="darkModeButton"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? 'light Mode' : 'Dark Mode'}
            </button>

            <button
              type="button"
              className="logoutButton"
              onClick={() => signOut(auth)}
            >
              Logout
            </button>
          </div>
        </header>

        <section className="riskSummary">
          <div className="summaryCard">
            <span>Total Transactions</span>
            <strong>{getRiskSummary(transactions).totalTransactions}</strong>
          </div>

          <div className="summaryCard">
            <span>Low Risk</span>
            <strong>{riskDistribution.Low}</strong>
          </div>

          <div className="summaryCard">
            <span>Medium Risk</span>
            <strong>{riskDistribution.Medium}</strong>
          </div>

          <div className="summaryCard">
            <span>High Risk</span>
            <strong>{riskDistribution.High}</strong>
          </div>

          <div className="summaryCard">
            <span>Critical Risk</span>
            <strong>{riskDistribution.Critical}</strong>
          </div>

          <div className="summaryCard">
            <span>Average Risk Score</span>
            <strong>{getRiskSummary(transactions).averageRiskScore}</strong>
          </div>
        </section>

        <section className="riskDistribution">
          <div className="sectionHeader">
            <h2>Risk Distribution</h2>
          </div>

          <div className="distributionGrid">
            <div className="distributionCard riskLow">
              <span>Low</span>
              <strong>{riskDistribution.Low}</strong>
            </div>

            <div className="distributionCard riskMedium">
              <span>Medium</span>
              <strong>{riskDistribution.Medium}</strong>
            </div>

            <div className="distributionCard riskHigh">
              <span>High</span>
              <strong>{riskDistribution.High}</strong>
            </div>

            <div className="distributionCard riskCritical">
              <span>Critical</span>
              <strong>{riskDistribution.Critical}</strong>
            </div>
          </div>

          <div className="riskChart">
            <ResponsiveContainer width="75%" height={220}>
              <BarChart
                data={riskChartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  cursor={false}
                  formatter={(value) => [value, 'Transactions']}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  <Cell fill="#22c55e" />
                  <Cell fill="#facc15" />
                  <Cell fill="#f97316" />
                  <Cell fill="#ef4444" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="transactionSection">
          <div className="sectionHeader">
            <h2>Your Transactions</h2>
            <div className="transactionControls">
              <input
                type="text"
                placeholder="search transactions..."
                value={searchTerm}
                onChange={(e) => setSeacrhTerm(e.target.value)}
              />

              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
              >
                <option value="all">All Risk Levels</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="risk">Highest Risk</option>
                <option value="lowestRisk">Lowest Risk</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
            <span>{transactions.length} transactions</span>
          </div>

          {transactions.length === 0 ? (
            <p className="emptyMessage">No Transaction Found.</p>
          ) : (
            <div className="transactionTable">
              <div className="tableHeader">
                <span>Transaction</span>
                <span>Amount</span>
                <span>Type</span>
                <span>Category</span>
                <span>Date</span>
                <span>Risk Score</span>
                <span>Risk Level</span>
              </div>

              {[...transactions]
                .filter((transaction) => {
                  const search = searchTerm.toLowerCase().trim();

                  const matchesSearch =
                    search === '' ||
                    (transaction.description || '')
                      .toLowerCase()
                      .includes(search) ||
                    (transaction.category || 'Other')
                      .toLowerCase()
                      .includes(search) ||
                    (transaction.type || '').toLowerCase().includes(search) ||
                    String(transaction.amount || '').includes(search);

                  if (!matchesSearch) {
                    return false;
                  }

                  if (riskFilter === 'all') {
                    return true;
                  }

                  return (
                    getRiskLevel(
                      calculateRiskScore(transaction, transactions)
                    ).toLowerCase() === riskFilter
                  );
                })

                .sort((a, b) => {
                  if (sortBy === 'risk') {
                    return (
                      calculateRiskScore(b, transactions) -
                      calculateRiskScore(a, transactions)
                    );
                  }

                  if (sortBy === 'lowestRisk') {
                    return (
                      calculateRiskScore(a, transactions) -
                      calculateRiskScore(b, transactions)
                    );
                  }

                  if (sortBy === 'newest') {
                    return (
                      new Date(b.dateTime || 0) - new Date(a.dateTime || 0)
                    );
                  }

                  if (sortBy === 'oldest') {
                    return (
                      new Date(a.dateTime || 0) - new Date(b.dateTime || 0)
                    );
                  }

                  return 0;
                })

                .map((transaction) => {
                  const riskScore = calculateRiskScore(
                    transaction,
                    transactions
                  );

                  const riskLevel = getRiskLevel(riskScore);

                  return (
                    <div
                      className="transactionRow"
                      key={transaction.id}
                      onClick={() => setSelectedTransaction(transaction)}
                    >
                      {/* Transaction */}
                      <div>
                        <strong className="transactionDescription">
                          {transaction.description || 'Unnamed Transaction'}
                        </strong>
                      </div>

                      {/* Amount */}
                      <div
                        className={`amountCell ${
                          transaction.type === 'income' ? 'income' : 'expense'
                        }`}
                      >
                        ₹
                        {Number(transaction.amount || 0).toLocaleString(
                          'en-IN'
                        )}
                      </div>

                      {/* Type */}
                      <div>
                        <span className={`typeBadge ${transaction.type}`}>
                          {transaction.type}
                        </span>
                      </div>

                      {/* Category */}
                      <div>
                        <span
                          className={`categoryBadge ${
                            (transaction.category || 'Other').toLowerCase() ===
                            'other'
                              ? 'other'
                              : ''
                          }`}
                        >
                          {transaction.category || 'Other'}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="transactionDate">
                        {transaction.dateTime
                          ? new Date(transaction.dateTime).toLocaleDateString(
                              'en-IN',
                              {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              }
                            )
                          : '-'}
                      </div>

                      {/* Risk Score */}
                      <div>
                        <div className="tableRiskScore">
                          <strong
                            className={`riskScore risk-${riskLevel.toLowerCase()}`}
                          >
                            {riskScore}
                          </strong>

                          <div className="tableRiskScoreBar">
                            <div
                              className={`tableRiskScoreBarFill risk-${riskLevel.toLowerCase()}`}
                              style={{
                                width: `${riskScore}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      {/* Risk Level */}
                      <div>
                        <span
                          className={`riskLevelBadge risk-${riskLevel.toLowerCase()}`}
                        >
                          {riskLevel}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {selectedTransaction && (
          <section className="investigationSection">
            <div className="sectionHeader">
              <h2>Transaction Investigation</h2>
              <p className="investigationSubtitle">
                Detailed analysis of why this transaction recieved its risk
                score.
              </p>
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
              >
                Close
              </button>
            </div>

            <div className="investigationContent">
              <div>
                <span> Transaction:</span>
                <strong>
                  {selectedTransaction.description || 'Unnamed Transaction'}
                </strong>
              </div>

              <div>
                <span>Amount: </span>
                <strong>
                  ₹
                  {Number(selectedTransaction.amount || 0).toLocaleString(
                    'en-IN'
                  )}
                </strong>
              </div>

              <div>
                <span>Type: </span>
                <strong>{selectedTransaction.type}</strong>
              </div>

              <div>
                <span>Category: </span>
                <strong>{selectedTransaction.category || 'Other'}</strong>
              </div>

              <div>
                <span>Date & Time</span>
                <strong>
                  {selectedTransaction.dateTime
                    ? new Date(selectedTransaction.dateTime).toLocaleString(
                        'en-IN',
                        {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        }
                      )
                    : '-'}
                </strong>
              </div>

              <div className="riskScoreCard">
                <span>Risk Score: </span>
                <div className="riskScoreCardValue">
                  <strong
                    className={`riskScoreValue risk-${getRiskLevel(
                      calculateRiskScore(selectedTransaction, transactions)
                    ).toLowerCase()}`}
                  >
                    {calculateRiskScore(selectedTransaction, transactions)}
                  </strong>
                  <span className="riskScoreOutOf">/ 100</span>
                </div>
                <div className="riskScoreBar">
                  <div
                    className={`riskScoreBarFill risk-${getRiskLevel(
                      calculateRiskScore(selectedTransaction, transactions)
                    ).toLowerCase()}`}
                    style={{
                      width: `${calculateRiskScore(
                        selectedTransaction,
                        transactions
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="riskLevelCard">
                <span>Risk Level: </span>
                <strong
                  className={`riskLevelValue risk-${getRiskLevel(
                    calculateRiskScore(selectedTransaction, transactions)
                  ).toLowerCase()}`}
                >
                  {getRiskLevel(
                    calculateRiskScore(selectedTransaction, transactions)
                  )}
                </strong>
                <p>Based on the comnibed behavioral risk signals.</p>
              </div>

              <div>
                <span>Previous Transactions</span>
                <strong>
                  {
                    getBehaviorAnalysis(selectedTransaction, transactions)
                      .previousCount
                  }
                </strong>
              </div>

              <div>
                <span>Historical Average</span>
                <strong>
                  ₹
                  {getBehaviorAnalysis(
                    selectedTransaction,
                    transactions
                  ).average.toLocaleString('en-IN')}
                </strong>
              </div>

              <div>
                <span>Behavior Deviation</span>
                <strong className="deviationValue">
                  {
                    getBehaviorAnalysis(selectedTransaction, transactions)
                      .deviation
                  }
                  %
                </strong>
              </div>
            </div>

            <div className="investigationExplanation">
              <h3>Why is this transaction risky?</h3>

              <p className="analysisIntro">
                The transaction is compared with the user's previous behaviour
                using three behavioral signals.
              </p>

              <div className="signalGrid">
                {/* Amount Signal */}
                <div className="signalCard">
                  <div className="signalHeader">
                    <span>Amount Deviation</span>

                    <strong>
                      {
                        getRiskSignals(selectedTransaction, transactions)
                          .amountScore
                      }
                      %
                    </strong>
                  </div>

                  <div className="signalBar">
                    <div
                      className="signalBarFill signalAmount"
                      style={{
                        width: `${
                          getRiskSignals(selectedTransaction, transactions)
                            .amountScore
                        }%`,
                      }}
                    ></div>
                  </div>

                  <p>
                    Measures how different this transaction amount is from the
                    historical average.
                  </p>

                  <small>
                    Risk Contribution:{' '}
                    {Math.round(
                      getRiskSignals(selectedTransaction, transactions)
                        .amountScore * 0.6
                    )}{' '}
                    points
                  </small>

                  <div className="signalWeight">Weight: 60%</div>
                </div>

                {/* Category Signal */}
                <div className="signalCard">
                  <div className="signalHeader">
                    <span>Category Signal</span>

                    <strong>
                      {
                        getRiskSignals(selectedTransaction, transactions)
                          .categoryScore
                      }
                      %
                    </strong>
                  </div>

                  <div className="signalBar">
                    <div
                      className="signalBarFill signalCategory"
                      style={{
                        width: `${
                          getRiskSignals(selectedTransaction, transactions)
                            .categoryScore
                        }%`,
                      }}
                    ></div>
                  </div>

                  <p>
                    Indicates how unusual this transaction category is compared
                    with previous behaviour.
                  </p>

                  <small>
                    Risk Contribution:{' '}
                    {Math.round(
                      getRiskSignals(selectedTransaction, transactions)
                        .categoryScore * 0.3
                    )}{' '}
                    points
                  </small>

                  <div className="signalWeight">Weight: 30%</div>
                </div>

                {/* Frequency Signal */}
                <div className="signalCard">
                  <div className="signalHeader">
                    <span>Frequency Signal</span>

                    <strong>
                      {
                        getRiskSignals(selectedTransaction, transactions)
                          .frequencyScore
                      }
                      %
                    </strong>
                  </div>

                  <div className="signalBar">
                    <div
                      className="signalBarFill signalFrequency"
                      style={{
                        width: `${
                          getRiskSignals(selectedTransaction, transactions)
                            .frequencyScore
                        }%`,
                      }}
                    ></div>
                  </div>

                  <p>Reflects unusually frequent recent transactions.</p>

                  <small>
                    Risk Contribution:{' '}
                    {Math.round(
                      getRiskSignals(selectedTransaction, transactions)
                        .frequencyScore * 0.1
                    )}{' '}
                    points
                  </small>

                  <div className="signalWeight">Weight: 10%</div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
