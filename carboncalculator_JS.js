document.addEventListener('DOMContentLoaded', function() {
    // Initially set input-only mode
    document.querySelector('.main-content').classList.add('input-only');
    
    document.getElementById('carbonForm').addEventListener('submit', function(e) {
        e.preventDefault();
        console.log("Form submitted");
        calculateFootprint();
    });
});

// Emission factors (Indian data, approximate)
const emissionFactors = {
    electricity: 0.82, // kg CO2 per kWh (Indian grid)
    gas: 5.3, // kg CO2 per therm (adjusted for Indian context)
    heating: {
        electric: 0.82,
        gas: 5.3,
        oil: 10.2,
        propane: 5.7,
        wood: 0.1
    },
    vehicles: {
        gasoline: 0.171, // kg CO2 per km (petrol car)
        hybrid: 0.085,
        electric: 0.05, // Lower due to Indian grid
        diesel: 0.184,
        suv: 0.237
    },
    flights: 90, // kg CO2 per hour
    diet: {
        omnivore: 1.85, // kg CO2 per day
        pescatarian: 1.6,
        vegetarian: 1.05,
        vegan: 0.63
    },
    waste: 0.5, // kg CO2 per bag per week
    recycling: {
        yes: 0.8,
        some: 0.9,
        no: 1.0
    }
};

let currentData = null;

function calculateFootprint() {
    const formData = new FormData(document.getElementById('carbonForm'));
    const data = Object.fromEntries(formData);

    // Fill in missing values with defaults
    Object.keys(data).forEach(key => {
        if (data[key] === '' || data[key] === null) {
            data[key] = 0;
        }
    });

    // Calculate emissions (annual kg CO2)
    const electricity = parseFloat(data.electricity || 0) * 12 * emissionFactors.electricity;
    const gas = parseFloat(data.gas || 0) * 12 * emissionFactors.gas;
    const heating = parseFloat(data.electricity || 0) * 12 * emissionFactors.heating[data.heating || 'electric'] * 0.3;
    const transportation = parseFloat(data.carMiles || 0) * 12 * emissionFactors.vehicles[data.carType || 'gasoline'];
    const flights = parseFloat(data.flights || 0) * emissionFactors.flights;
    const diet = 365 * emissionFactors.diet[data.diet || 'omnivore'];
    const waste = parseFloat(data.waste || 0) * 52 * emissionFactors.waste * emissionFactors.recycling[data.recycling || 'some'];

    const total = electricity + gas + heating + transportation + flights + diet + waste;

    currentData = {
        total: total / 1000, // Convert to tons
        breakdown: {
            'Home Energy': (electricity + gas + heating) / 1000,
            'Transportation': (transportation + flights) / 1000,
            'Diet': diet / 1000,
            'Waste': waste / 1000
        },
        monthly: generateMonthlyData(total),
        inputs: data
    };

    // Calculate equivalent trees (1 tree absorbs ~22 kg CO2/year)
    currentData.trees = Math.round(total / 22);

    displayResults();
}

function generateMonthlyData(annualTotal) {
    const baseMonthly = annualTotal / 12000;
    return [
        { month: 'Jan', value: baseMonthly * 1.1 },
        { month: 'Feb', value: baseMonthly * 1.1 },
        { month: 'Mar', value: baseMonthly },
        { month: 'Apr', value: baseMonthly },
        { month: 'May', value: baseMonthly },
        { month: 'Jun', value: baseMonthly * 1.1 },
        { month: 'Jul', value: baseMonthly * 1.2 },
        { month: 'Aug', value: baseMonthly * 1.2 },
        { month: 'Sep', value: baseMonthly },
        { month: 'Oct', value: baseMonthly },
        { month: 'Nov', value: baseMonthly * 1.05 },
        { month: 'Dec', value: baseMonthly * 1.1 }
    ];
}

function displayResults() {
    const container = document.getElementById('resultsContainer');
    container.classList.remove('hidden');
    container.classList.add('show');
    
    // Switch to two-column layout when results are shown
    document.querySelector('.main-content').classList.remove('input-only');

    document.getElementById('totalValue').textContent = currentData.total.toFixed(1);
    document.getElementById('treeCount').textContent = currentData.trees;
    document.getElementById('trees').classList.remove('hidden');

    displayBreakdownStats();
    createPieChart();
    createBarChart();
    generateRecommendations();

    document.getElementById('downloadBtn').onclick = function() {
        const report = `
Household Carbon Footprint Report
==============================
Total Emissions: ${currentData.total.toFixed(1)} tons CO₂/year
Equivalent to ${currentData.trees} trees absorbing CO₂ for a year!

Breakdown:
- Home Energy: ${currentData.breakdown['Home Energy'].toFixed(1)} tons CO₂/year
- Transportation: ${currentData.breakdown['Transportation'].toFixed(1)} tons CO₂/year
- Diet: ${currentData.breakdown['Diet'].toFixed(1)} tons CO₂/year
- Waste: ${currentData.breakdown['Waste'].toFixed(1)} tons CO₂/year

Ways to Reduce Your Footprint:
${document.getElementById('recommendations').innerText}
        `;
        const blob = new Blob([report], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'carbon_footprint_report.txt';
        link.click();
    };
}

function displayBreakdownStats() {
    const statsContainer = document.getElementById('breakdownStats');
    statsContainer.innerHTML = '';
    Object.entries(currentData.breakdown).forEach(([category, value]) => {
        const statCard = document.createElement('div');
        statCard.className = 'stat-card fade-in';
        statCard.innerHTML = `
            <div class="stat-value">${value.toFixed(1)}</div>
            <div class="stat-label">${category} (tons/year)</div>
        `;
        statsContainer.appendChild(statCard);
    });
}

function createPieChart() {
    const container = d3.select('#pieChart');
    container.selectAll('*').remove();

    const containerWidth = document.getElementById('pieChart').clientWidth;
    const width = Math.min(400, containerWidth - 20);
    const height = width;
    const radius = width / 2;

    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];
    const color = d3.scaleOrdinal(colors);

    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width/2},${height/2})`);

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(0).outerRadius(radius - 20);

    const data = Object.entries(currentData.breakdown).map(([key, value]) => ({
        category: key,
        value: value
    }));

    const arcs = svg.selectAll('.arc')
        .data(pie(data))
        .enter().append('g')
        .attr('class', 'arc');

    arcs.append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => color(i))
        .style('cursor', 'pointer')
        .on('mouseover', handlePieChartMouseOver)
        .on('mouseout', handleMouseOut)
        .transition()
        .duration(1000)
        .attrTween('d', function(d) {
            const interpolate = d3.interpolate({startAngle: 0, endAngle: 0}, d);
            return function(t) { return arc(interpolate(t)); };
        });

    createPieChartLegend(data, colors);
}

function createPieChartLegend(data, colors) {
    const legend = document.getElementById('pieChartLegend');
    legend.innerHTML = '';
    data.forEach((d, i) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <div class="legend-color" style="background-color: ${colors[i]}"></div>
            <span>${d.category}</span>
        `;
        legend.appendChild(legendItem);
    });
}

function createBarChart() {
    const container = d3.select('#barChart');
    container.selectAll('*').remove();

    const margin = {top: 20, right: 30, bottom: 40, left: 50};
    const containerWidth = document.getElementById('barChart').clientWidth;
    const width = Math.min(500, containerWidth - 20) - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .rangeRound([0, width])
        .padding(0.1)
        .domain(currentData.monthly.map(d => d.month));

    const y = d3.scaleLinear()
        .rangeRound([height, 0])
        .domain([0, d3.max(currentData.monthly, d => d.value)]);

    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append('g')
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => d.toFixed(1)));

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', '#666')
        .text('CO₂ Emissions (tons)');

    svg.selectAll('.bar')
        .data(currentData.monthly)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.month))
        .attr('y', height)
        .attr('width', x.bandwidth())
        .attr('height', 0)
        .attr('fill', '#4ecdc4')
        .style('cursor', 'pointer')
        .on('mouseover', handleBarChartMouseOver)
        .on('mouseout', handleMouseOut)
        .transition()
        .duration(1000)
        .delay((d, i) => i * 100)
        .attr('y', d => y(d.value))
        .attr('height', d => height - y(d.value));
}

function handlePieChartMouseOver(event, d) {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.opacity = 1;
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY - 10) + 'px';
    tooltip.innerHTML = `${d.data.category}: ${d.data.value.toFixed(1)} tons CO₂`;
}

function handleBarChartMouseOver(event, d) {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.opacity = 1;
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY - 10) + 'px';
    tooltip.innerHTML = `${d.month}: ${d.value.toFixed(2)} tons CO₂`;
}

function handleMouseOut() {
    document.getElementById('tooltip').style.opacity = 0;
}

function generateRecommendations() {
    const container = document.getElementById('recommendations');
    container.innerHTML = '';
    const recommendations = [];
    const inputs = currentData.inputs;

    if (parseFloat(inputs.electricity) > 200) {
        const savings = (parseFloat(inputs.electricity) - 200) * 12 * emissionFactors.electricity / 1000;
        recommendations.push(`💡 Use LED bulbs to save ${savings.toFixed(1)} tons CO₂/year.`);
    }
    if (parseFloat(inputs.gas) > 5) {
        const savings = (parseFloat(inputs.gas) - 5) * 12 * emissionFactors.gas / 1000;
        recommendations.push(`🔥 Switch to efficient gas appliances to save ${savings.toFixed(1)} tons CO₂/year.`);
    }
    if (parseFloat(inputs.carMiles) > 800) {
        const savings = (parseFloat(inputs.carMiles) - 800) * 12 * emissionFactors.vehicles[inputs.carType || 'gasoline'] / 1000;
        recommendations.push(`🚗 Try public transport or carpooling to save ${savings.toFixed(1)} tons CO₂/year.`);
    }
    if (parseFloat(inputs.flights) > 10) {
        recommendations.push(`✈️ Reduce flights or offset emissions to lower your footprint.`);
    }
    if (inputs.diet === 'omnivore' || inputs.diet === 'pescatarian') {
        recommendations.push(`🥗 Eat vegetarian meals 2 days a week to save ~0.4 tons CO₂/year.`);
    }
    if (parseFloat(inputs.waste) > 2) {
        recommendations.push(`♻️ Recycle more to cut waste emissions by ~0.2 tons CO₂/year.`);
    }
    if (inputs.heating === 'oil' || inputs.heating === 'propane') {
        recommendations.push(`🌡️ Use efficient heating like heat pumps to reduce emissions.`);
    }
    if (recommendations.length < 3) {
        recommendations.push(
            `🌡️ Lower your thermostat by 2°C to save ~0.5 tons CO₂/year.`,
            `🚲 Walk or bike for short trips to reduce emissions.`,
            `🏠 Insulate your home to save 20-40% on heating/cooling emissions.`
        );
    }

    recommendations.slice(0, 5).forEach(rec => {
        const item = document.createElement('div');
        item.className = 'recommendation-item';
        item.textContent = rec;
        container.appendChild(item);
    });
}