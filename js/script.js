// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const getImagesButton = document.getElementById('getImagesButton');
const gallery = document.getElementById('gallery');
const imageDialog = document.getElementById('imageDialog');
const closeImageDialog = document.getElementById('closeImageDialog');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');
const apodEndpoint = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic/';

// NASA provides DEMO_KEY for trying the API without registering for a key.
const apiKey = 'DEMO_KEY';

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

// Fetch the APOD entries between the selected dates when the button is clicked.
getImagesButton.addEventListener('click', getSpaceImages);
closeImageDialog.addEventListener('click', () => imageDialog.close());

imageDialog.addEventListener('click', (event) => {
	if (event.target === imageDialog) {
		imageDialog.close();
	}
});

async function getSpaceImages() {
	const startDate = startInput.value;
	const endDate = endInput.value;

	if (!startDate || !endDate || startDate > endDate) {
		gallery.textContent = 'Choose a valid date range to get space images.';
		return;
	}

	gallery.textContent = 'Loading space photos...';
	getImagesButton.disabled = true;

	try {
		const perPage = 100;
		const firstPageData = await fetchApodPage(1, perPage);
		const newestDate = new Date(`${firstPageData.entries[0].date}T00:00:00Z`);
		const startDateValue = new Date(`${startDate}T00:00:00Z`);
		const endDateValue = new Date(`${endDate}T00:00:00Z`);
		const millisecondsPerDay = 24 * 60 * 60 * 1000;

		// Estimate which pages contain the selected dates, then include nearby pages
		// to account for dates that may not have an APOD entry.
		const daysToEndDate = Math.max(0, Math.floor((newestDate - endDateValue) / millisecondsPerDay));
		const daysToStartDate = Math.max(0, Math.floor((newestDate - startDateValue) / millisecondsPerDay));
		const firstPageForRange = Math.floor(daysToEndDate / perPage) + 1;
		const lastPageForRange = Math.floor(daysToStartDate / perPage) + 1;
		const firstPageToFetch = Math.max(1, firstPageForRange - 1);
		const lastPageToFetch = Math.min(firstPageData.totalPages, lastPageForRange + 1);
		const allEntries = [...firstPageData.entries];

		for (let page = firstPageToFetch; page <= lastPageToFetch; page += 1) {
			if (page === 1) {
				continue;
			}

			const pageData = await fetchApodPage(page, perPage);
			allEntries.push(...pageData.entries);
		}

		const spaceImages = allEntries.filter((entry) =>
			entry.media_type === 'image' && entry.date >= startDate && entry.date <= endDate
		);
		showSpaceImages(spaceImages);
	} catch (error) {
		gallery.textContent = `Unable to load space images: ${error.message}`;
	} finally {
		getImagesButton.disabled = false;
	}
}

async function fetchApodPage(page, perPage) {
	const url = new URL(apodEndpoint);
	url.searchParams.set('per_page', perPage);
	url.searchParams.set('page', page);

	const response = await fetch(url);

	if (!response.ok) {
		throw new Error('NASA could not return space images. Please try again.');
	}

	const entries = await response.json();
	const totalPages = Number(response.headers.get('X-WP-TotalPages')) || page;

	return { entries, totalPages };
}

function showSpaceImages(spaceImages) {
	gallery.replaceChildren();

	if (spaceImages.length === 0) {
		gallery.textContent = 'No space images were found for that date range.';
		return;
	}

	spaceImages.forEach((spaceImage) => {
		const imageCard = document.createElement('article');
		imageCard.className = 'gallery-item';

		const openButton = document.createElement('button');
		openButton.className = 'gallery-open-button';
		openButton.type = 'button';
		openButton.setAttribute('aria-label', `View ${spaceImage.title}, ${spaceImage.date}`);

		const imageUrl = spaceImage.hdurl || (spaceImage.media_type === 'image' ? spaceImage.url : '');

		if (imageUrl) {
			const image = document.createElement('img');
			image.src = imageUrl;
			image.alt = '';
			image.loading = 'lazy';
			openButton.appendChild(image);
		}

		const title = document.createElement('h2');
		title.textContent = spaceImage.title;
		openButton.appendChild(title);

		const date = document.createElement('p');
		date.textContent = spaceImage.date;
		openButton.appendChild(date);
		openButton.addEventListener('click', () => showImageDetails(spaceImage, imageUrl));
		imageCard.appendChild(openButton);

		if (spaceImage.media_type === 'video') {
			const videoLink = document.createElement('a');
			videoLink.href = spaceImage.permalink || spaceImage.url;
			videoLink.textContent = 'View this APOD on NASA';
			videoLink.target = '_blank';
			videoLink.rel = 'noopener noreferrer';
			imageCard.appendChild(videoLink);
		}

		gallery.appendChild(imageCard);
	});
}

function showImageDetails(spaceImage, imageUrl) {
	modalTitle.textContent = spaceImage.title;
	modalDate.textContent = spaceImage.date;
	modalExplanation.textContent = new DOMParser()
		.parseFromString(spaceImage.explanation || '', 'text/html')
		.body.textContent;

	if (imageUrl) {
		modalImage.src = imageUrl;
		modalImage.alt = spaceImage.alt || spaceImage.title;
		modalImage.hidden = false;
	} else {
		modalImage.removeAttribute('src');
		modalImage.hidden = true;
	}

	imageDialog.showModal();
}
